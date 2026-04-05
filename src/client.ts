export const DEFAULT_JQA_BASE_URL = 'https://jooja-auth.leverton.dev';

export type HealthResponse = { ok: true };

export type ProviderStatusResponse = {
  /** UUID (principal id). */
  principalId: string;
  /** Provider id (e.g. "google"). */
  providerId: string;
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

export type JqaClientOpts = {
  /** Base URL override. If omitted, defaults to the public JQA deployment. */
  baseUrl?: string;

  /** Optional: admin API key for /v1/admin/* endpoints. */
  adminApiKey?: string;

  /** UUID principal id (JQA_UUID). */
  uuid?: string;

  /** Per-principal secret (JQA_SECRET). */
  secret?: string;

  /** Legacy shared bearer token (transition only). Prefer UUID+secret. */
  bearerToken?: string;
};

function basicAuthHeader(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`;
}

export class JqaClient {
  readonly baseUrl: string;
  readonly adminApiKey?: string;
  readonly uuid?: string;
  readonly secret?: string;
  readonly bearerToken?: string;

  constructor(opts: JqaClientOpts = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_JQA_BASE_URL).replace(/\/+$/, '');
    this.adminApiKey = opts.adminApiKey;
    this.uuid = opts.uuid;
    this.secret = opts.secret;
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
   * Returns the provider OAuth consent URL.
   *
   * JQA redirects by default, but when `Accept: application/json` is set,
   * it returns `{ url }` instead.
   */
  async connectUrl(opts: { providerId: string; uuid?: string; scopes?: string }): Promise<string> {
    const principalId = opts.uuid ?? this.uuid;
    if (!principalId) throw new Error('Missing uuid (JQA_UUID)');

    const res = await this.fetchJson<{ url: string }>(
      'GET',
      `/v1/providers/${encodeURIComponent(opts.providerId)}/auth/start`,
      {
        query: { principalId, scopes: opts.scopes }
      }
    );

    if ('json' in res && res.status === 200 && typeof res.json.url === 'string') return res.json.url;

    if ('json' in res) {
      throw new Error(`Failed to build connect url: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`Failed to build connect url: HTTP ${res.status} ${res.text}`);
  }

  async status(opts: { providerId: string; uuid?: string }): Promise<ProviderStatusResponse> {
    const principalId = opts.uuid ?? this.uuid;
    if (!principalId) throw new Error('Missing uuid (JQA_UUID)');

    const res = await this.fetchJson<ProviderStatusResponse>(
      'GET',
      `/v1/providers/${encodeURIComponent(opts.providerId)}/status`,
      {
        query: { principalId }
      }
    );

    if ('json' in res && res.status === 200) return res.json;

    if ('json' in res) {
      throw new Error(`Failed to fetch status: HTTP ${res.status} ${JSON.stringify(res.json)}`);
    }

    throw new Error(`Failed to fetch status: HTTP ${res.status} ${res.text}`);
  }

  async adminStats(): Promise<AdminStatsResponse> {
    if (!this.adminApiKey) throw new Error('Missing adminApiKey (JQA_ADMIN_API_KEY)');

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

  async adminTokens(filter?: { providerId?: string; uuid?: string }): Promise<AdminTokenListItem[]> {
    if (!this.adminApiKey) throw new Error('Missing adminApiKey (JQA_ADMIN_API_KEY)');

    const res = await this.fetchJson<AdminTokenListItem[]>('GET', '/v1/admin/tokens', {
      query: { providerId: filter?.providerId, principalId: filter?.uuid },
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
    if (!this.adminApiKey) throw new Error('Missing adminApiKey (JQA_ADMIN_API_KEY)');

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
    if (!this.adminApiKey) throw new Error('Missing adminApiKey (JQA_ADMIN_API_KEY)');

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
   * Request a short-lived provider access token from JQA.
   *
   * Preferred auth: `Authorization: Basic base64(uuid:secret)`.
   *
   * JQA returns access tokens only (refresh token never leaves the service).
   */
  async tokenAccess(opts: {
    providerId: string;
    minTtlSec?: number;
    forceRefresh?: boolean;
    uuid?: string;
    secret?: string;
  }): Promise<TokenAccessResponse> {
    const principalId = opts.uuid ?? this.uuid;
    const clientSecret = opts.secret ?? this.secret;

    if (!principalId) throw new Error('Missing uuid (JQA_UUID)');
    if (!clientSecret) throw new Error('Missing secret (JQA_SECRET)');

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
   * Requires hub-side TOKEN_BEARER_TOKEN and client-side JQA_BEARER_TOKEN.
   */
  async tokenAccessLegacyBearer(opts: {
    principalId: string;
    providerId: string;
    minTtlSec?: number;
    forceRefresh?: boolean;
  }): Promise<TokenAccessResponse | null> {
    if (!this.bearerToken) throw new Error('Missing bearerToken (JQA_BEARER_TOKEN)');

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

/**
 * Backwards-compatible alias for older internal code.
 *
 * @deprecated Prefer `JqaClient`.
 */
export type AuthHubClientOpts = {
  baseUrl: string;
  adminApiKey?: string;
  principalId?: string;
  clientSecret?: string;
  bearerToken?: string;
};

/**
 * @deprecated Prefer `JqaClient`.
 */
export class AuthHubClient extends JqaClient {
  constructor(opts: AuthHubClientOpts) {
    super({
      baseUrl: opts.baseUrl,
      adminApiKey: opts.adminApiKey,
      uuid: opts.principalId,
      secret: opts.clientSecret,
      bearerToken: opts.bearerToken
    });
  }

  async googleConnectUrl(opts: { principalId: string; scopes?: string }): Promise<string> {
    return this.connectUrl({ providerId: 'google', uuid: opts.principalId, scopes: opts.scopes });
  }

  async googleStatus(opts: { principalId: string }): Promise<ProviderStatusResponse> {
    return this.status({ providerId: 'google', uuid: opts.principalId });
  }
}
