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

export type AdminPrincipalListItem = {
  principalId: string;
  createdAt: string;
  updatedAt: string;
  displayName: string | null;
  legacyPrincipalRef: string | null;
  meta: Record<string, unknown> | null;
};

export type AdminCreatePrincipalResponse = {
  principalId: string;
  clientSecret: string;
  createdAt: string;
  displayName: string | null;
  legacyPrincipalRef: string | null;
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

  /** v2 identity (preferred) */
  principalId?: string;
  clientSecret?: string;

  /** legacy shared bearer token (optional; backward compat) */
  bearerToken?: string;
};

function basicAuthHeader(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`;
}

export class AuthHubClient {
  readonly baseUrl: string;
  readonly adminApiKey?: string;
  readonly principalId?: string;
  readonly clientSecret?: string;
  readonly bearerToken?: string;

  constructor(opts: AuthHubClientOpts) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.adminApiKey = opts.adminApiKey;
    this.principalId = opts.principalId;
    this.clientSecret = opts.clientSecret;
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
   * The hub redirects by default, but if we set Accept: application/json,
   * it returns { url } instead.
   */
  async googleConnectUrl(opts: { principalId: string; scopes?: string }): Promise<string> {
    const res = await this.fetchJson<{ url: string }>('GET', '/v1/providers/google/auth/start', {
      query: { principalId: opts.principalId, scopes: opts.scopes }
    });

    if ('json' in res && res.status === 200 && typeof res.json.url === 'string') return res.json.url;

    if ('json' in res) {
      throw new Error(`Failed to build connect url: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`Failed to build connect url: HTTP ${res.status} ${res.text}`);
  }

  async googleStatus(opts: { principalId: string }): Promise<GoogleStatusResponse> {
    const res = await this.fetchJson<GoogleStatusResponse>('GET', '/v1/providers/google/status', {
      query: { principalId: opts.principalId }
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

  async adminPrincipals(): Promise<AdminPrincipalListItem[]> {
    if (!this.adminApiKey) throw new Error('Missing adminApiKey (AUTH_HUB_ADMIN_API_KEY)');

    const res = await this.fetchJson<AdminPrincipalListItem[]>('GET', '/v1/admin/principals', {
      headers: {
        'x-api-key': this.adminApiKey
      }
    });

    if ('json' in res && res.status === 200) return res.json;

    if ('json' in res) {
      throw new Error(`Failed principal list: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`Failed principal list: HTTP ${res.status} ${res.text}`);
  }

  async adminCreatePrincipal(opts?: { displayName?: string; legacyPrincipalRef?: string }): Promise<AdminCreatePrincipalResponse> {
    if (!this.adminApiKey) throw new Error('Missing adminApiKey (AUTH_HUB_ADMIN_API_KEY)');

    const res = await this.fetchJson<AdminCreatePrincipalResponse>('POST', '/v1/admin/principals', {
      headers: {
        'x-api-key': this.adminApiKey
      },
      body: {
        displayName: opts?.displayName,
        legacyPrincipalRef: opts?.legacyPrincipalRef
      }
    });

    if ('json' in res && res.status === 201) return res.json;

    if ('json' in res) {
      throw new Error(`Failed to create principal: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`Failed to create principal: HTTP ${res.status} ${res.text}`);
  }

  /**
   * Request a short-lived provider access token from the hub.
   *
   * Preferred auth: `Authorization: Basic base64(principalId:clientSecret)`.
   *
   * The hub returns access tokens only (refresh token never leaves the hub).
   */
  async tokenAccess(opts: {
    providerId: string;
    minTtlSec?: number;
    forceRefresh?: boolean;
    principalId?: string;
    clientSecret?: string;
  }): Promise<TokenAccessResponse> {
    const principalId = opts.principalId ?? this.principalId;
    const clientSecret = opts.clientSecret ?? this.clientSecret;

    if (!principalId) throw new Error('Missing principalId (AUTH_HUB_PRINCIPAL_ID)');
    if (!clientSecret) throw new Error('Missing clientSecret (AUTH_HUB_CLIENT_SECRET)');

    const res = await this.fetchJson<TokenAccessResponse>('POST', '/v1/tokens/access', {
      headers: { authorization: basicAuthHeader(principalId, clientSecret) },
      body: {
        providerId: opts.providerId,
        minTtlSec: opts.minTtlSec,
        forceRefresh: opts.forceRefresh
      }
    });

    if ('json' in res && res.status === 200) return res.json;

    if ('json' in res) {
      throw new Error(`tokenAccess failed: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`tokenAccess failed: HTTP ${res.status} ${res.text}`);
  }

  /**
   * Legacy Bearer-mode token retrieval for older scripts.
   *
   * Requires hub-side TOKEN_BEARER_TOKEN and client-side AUTH_HUB_BEARER_TOKEN.
   */
  async tokenAccessLegacyBearer(opts: {
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
      throw new Error(`tokenAccessLegacyBearer failed: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`tokenAccessLegacyBearer failed: HTTP ${res.status} ${res.text}`);
  }
}
