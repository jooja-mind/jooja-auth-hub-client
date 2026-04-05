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

export type TokenAccessResponse = {
  ok: true;
  providerId: string;
  principalId: string;
  tokenType: string;
  scope: string | null;
  accessToken: string;
  issuedAt: string;
  expiresAt: string | null;
  source: 'cache' | 'refresh';
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
      body?: unknown;
    }
  ): Promise<{ status: number; json: T } | { status: number; text: string }> {
    const url = this.makeUrl(path, opts?.query);

    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(Object.fromEntries(
        Object.entries(opts?.headers ?? {}).filter(([, v]) => typeof v === 'string') as Array<[string, string]>
      ) as Record<string, string>)
    };

    const init: RequestInit = { method, headers };
    if (opts && 'body' in opts && opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, init);

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
   * Request a short-lived provider access token from the hub.
   *
   * Requires hub-side TOKEN_BEARER_TOKEN and client-side AUTH_HUB_BEARER_TOKEN.
   */
  async tokenAccess(opts: {
    principalId: string;
    providerId: string;
    minTtlSec?: number;
    forceRefresh?: boolean;
  }): Promise<TokenAccessResponse | null> {
    if (!this.bearerToken) throw new Error('Missing bearerToken (AUTH_HUB_BEARER_TOKEN)');

    const res = await this.fetchJson<TokenAccessResponse>('POST', '/v1/tokens/access', {
      headers: { authorization: `Bearer ${this.bearerToken}` },
      body: {
        principalId: opts.principalId,
        providerId: opts.providerId,
        minTtlSec: opts.minTtlSec,
        forceRefresh: opts.forceRefresh
      }
    });

    if (res.status === 404) return null;

    if ('json' in res && res.status === 200) return res.json;

    if ('json' in res) {
      throw new Error(`tokenAccess failed: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`tokenAccess failed: HTTP ${res.status} ${res.text}`);
  }

  /**
   * @deprecated Backwards-compat alias for older scripts.
   * Use tokenAccess() instead.
   */
  async tokenGetPlaceholder(opts: { principalId: string; providerId: string }): Promise<TokenAccessResponse | null> {
    return this.tokenAccess(opts);
  }
}
