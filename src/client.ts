export type HealthResponse = { ok: true };

export type GoogleStatusResponse = {
  principalId: string;
  providerId: 'google';
  hasToken: boolean;
  updatedAt: string | null;
};

export type AdminStatsResponse = {
  ok: true;
  principals: number;
  tokens: number;
  byProvider: Record<string, number>;
};

export type AdminTokenListItem = {
  providerId: string;
  principalId: string;
  createdAt: string;
  updatedAt: string;
};

export type TokenGetPlaceholderResponse = {
  token?: unknown;
};

export type AuthHubClientOpts = {
  baseUrl: string;
  adminApiKey?: string;
  bearerToken?: string;
};

export class AuthHubClient {
  readonly baseUrl: string;
  readonly adminApiKey?: string;
  readonly bearerToken?: string;

  constructor(opts: AuthHubClientOpts) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.adminApiKey = opts.adminApiKey;
    this.bearerToken = opts.bearerToken;
  }

  private makeUrl(path: string, query?: Record<string, string | undefined>) {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, v);
      }
    }
    return url;
  }

  private async fetchJson<T>(
    method: 'GET' | 'POST',
    path: string,
    opts?: {
      query?: Record<string, string | undefined>;
      headers?: Record<string, string | undefined>;
    }
  ): Promise<{ status: number; json: T } | { status: number; text: string }> {
    const url = this.makeUrl(path, opts?.query);

    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(Object.fromEntries(
        Object.entries(opts?.headers ?? {}).filter(([, v]) => typeof v === 'string') as Array<[string, string]>
      ) as Record<string, string>)
    };

    const res = await fetch(url, { method, headers });

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as T;
      return { status: res.status, json };
    }

    const text = await res.text();
    return { status: res.status, text };
  }

  async health(): Promise<HealthResponse> {
    const res = await this.fetchJson<HealthResponse>('GET', '/health');
    if ('json' in res && res.status === 200) return res.json;
    throw new Error(`Unexpected /health response: HTTP ${res.status}`);
  }

  /**
   * Returns the Google OAuth consent URL.
   *
   * The hub will redirect by default, but if we set Accept: application/json,
   * it returns { url } instead.
   */
  async googleConnectUrl(opts: { principal: string; scopes?: string }): Promise<string> {
    const res = await this.fetchJson<{ url: string }>('GET', '/auth/google/start', {
      query: { principal: opts.principal, scopes: opts.scopes }
    });

    if ('json' in res && res.status === 200 && typeof res.json.url === 'string') return res.json.url;

    if ('json' in res) {
      throw new Error(`Failed to build connect url: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`Failed to build connect url: HTTP ${res.status} ${res.text}`);
  }

  async googleStatus(opts: { principal: string }): Promise<GoogleStatusResponse> {
    const res = await this.fetchJson<GoogleStatusResponse>('GET', '/v1/providers/google/status', {
      query: { principal: opts.principal }
    });

    if ('json' in res && res.status === 200) return res.json;

    if ('json' in res) {
      throw new Error(`Failed to fetch status: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`Failed to fetch status: HTTP ${res.status} ${res.text}`);
  }

  async adminStats(): Promise<AdminStatsResponse> {
    if (!this.adminApiKey) throw new Error('Missing adminApiKey (AUTH_HUB_ADMIN_API_KEY)');

    const res = await this.fetchJson<AdminStatsResponse>('GET', '/v1/admin/stats', {
      headers: {
        'x-api-key': this.adminApiKey
      }
    });

    if ('json' in res && res.status === 200) return res.json;

    if ('json' in res) {
      throw new Error(`Failed admin stats: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`Failed admin stats: HTTP ${res.status} ${res.text}`);
  }

  async adminTokens(filter?: { providerId?: string; principalId?: string }): Promise<AdminTokenListItem[]> {
    if (!this.adminApiKey) throw new Error('Missing adminApiKey (AUTH_HUB_ADMIN_API_KEY)');

    const res = await this.fetchJson<AdminTokenListItem[]>('GET', '/v1/admin/tokens', {
      query: { providerId: filter?.providerId, principalId: filter?.principalId },
      headers: {
        'x-api-key': this.adminApiKey
      }
    });

    if ('json' in res && res.status === 200) return res.json;

    if ('json' in res) {
      throw new Error(`Failed admin token list: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`Failed admin token list: HTTP ${res.status} ${res.text}`);
  }

  /**
   * Placeholder for a future, strongly-authenticated token retrieval endpoint.
   *
   * IMPORTANT: jooja-auth-hub does NOT expose tokens in v0.
   */
  async tokenGetPlaceholder(opts: { principalId: string; providerId: string }): Promise<TokenGetPlaceholderResponse | null> {
    const res = await this.fetchJson<TokenGetPlaceholderResponse>('GET', '/v1/tokens/get', {
      query: { principalId: opts.principalId, providerId: opts.providerId },
      headers: this.bearerToken ? { authorization: `Bearer ${this.bearerToken}` } : undefined
    });

    if (res.status === 404) return null;

    if ('json' in res && res.status === 200) return res.json;

    if ('json' in res) {
      throw new Error(`tokenGetPlaceholder failed: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`tokenGetPlaceholder failed: HTTP ${res.status} ${res.text}`);
  }
}
