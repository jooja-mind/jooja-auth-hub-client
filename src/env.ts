import { DEFAULT_JQA_BASE_URL, JqaClient, type JqaClientOpts, type TokenAccessResponse } from './client.js';

export type JqaEnvConfig = {
  baseUrl: string;
  uuid?: string;
  secret?: string;
  provider?: string;
  adminApiKey?: string;
  bearerToken?: string;
};

/**
 * Loads JQA-related configuration from environment variables.
 *
 * Canonical env vars (preferred):
 * - JQA_UUID
 * - JQA_SECRET
 * - JQA_PROVIDER
 * - JQA_BASE_URL (optional override)
 * - JQA_ADMIN_API_KEY (optional; admin endpoints only)
 *
 * Legacy fallbacks are supported to ease migration:
 * - AUTH_HUB_BASE_URL, AUTH_HUB_PRINCIPAL_ID, AUTH_HUB_CLIENT_SECRET, AUTH_HUB_ADMIN_API_KEY, AUTH_HUB_BEARER_TOKEN
 */
export function loadJqaEnv(env: Record<string, string | undefined> = process.env): JqaEnvConfig {
  const baseUrl = (env.JQA_BASE_URL ?? env.AUTH_HUB_BASE_URL ?? DEFAULT_JQA_BASE_URL).replace(/\/+$/, '');

  return {
    baseUrl,
    uuid: env.JQA_UUID ?? env.AUTH_HUB_PRINCIPAL_ID,
    secret: env.JQA_SECRET ?? env.AUTH_HUB_CLIENT_SECRET,
    provider: env.JQA_PROVIDER,
    adminApiKey: env.JQA_ADMIN_API_KEY ?? env.AUTH_HUB_ADMIN_API_KEY,
    bearerToken: env.JQA_BEARER_TOKEN ?? env.AUTH_HUB_BEARER_TOKEN
  };
}

export function createJqaClientFromEnv(env: Record<string, string | undefined> = process.env): JqaClient {
  const cfg = loadJqaEnv(env);
  const opts: JqaClientOpts = {
    baseUrl: cfg.baseUrl,
    uuid: cfg.uuid,
    secret: cfg.secret,
    adminApiKey: cfg.adminApiKey,
    bearerToken: cfg.bearerToken
  };
  return new JqaClient(opts);
}

/**
 * Convenience helper: returns only the raw access token string.
 */
export async function getAccessTokenFromEnv(
  env: Record<string, string | undefined> = process.env,
  opts?: { minTtlSec?: number; forceRefresh?: boolean; providerId?: string }
): Promise<string> {
  const cfg = loadJqaEnv(env);
  const providerId = opts?.providerId ?? cfg.provider;
  if (!providerId) throw new Error('Missing providerId (set JQA_PROVIDER or pass providerId)');

  const client = createJqaClientFromEnv(env);
  const res: TokenAccessResponse = await client.tokenAccess({
    providerId,
    minTtlSec: opts?.minTtlSec,
    forceRefresh: opts?.forceRefresh
  });
  return res.accessToken;
}

export type AppleMusicTokenPair = {
  developerToken: string;
  musicUserToken: string;
  storefront: string | null;
  issuedAt: string;
  expiresAt: string | null;
};

/**
 * Convenience helper for Apple Music.
 *
 * Apple Music requires TWO tokens:
 * - Developer Token (JWT): `Authorization: Bearer ...`
 * - Music User Token: `Music-User-Token: ...`
 */
export async function getAppleMusicTokensFromEnv(
  env: Record<string, string | undefined> = process.env,
  opts?: { minTtlSec?: number; forceRefresh?: boolean }
): Promise<AppleMusicTokenPair> {
  const client = createJqaClientFromEnv(env);

  const res: TokenAccessResponse = await client.tokenAccess({
    providerId: 'applemusic',
    minTtlSec: opts?.minTtlSec,
    forceRefresh: opts?.forceRefresh
  });

  const musicUserToken = res.musicUserToken;
  if (!musicUserToken) {
    throw new Error('JQA did not return musicUserToken (is Apple Music connected for this principal?)');
  }

  return {
    developerToken: res.accessToken,
    musicUserToken,
    storefront: res.storefront ?? null,
    issuedAt: res.issuedAt,
    expiresAt: res.expiresAt
  };
}
