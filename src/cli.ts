#!/usr/bin/env node

import { AuthHubClient } from './client.js';

type ParsedArgs = {
  positionals: string[];
  flags: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';

    if (a === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (a.startsWith('--')) {
      const raw = a.slice(2);
      const eqIdx = raw.indexOf('=');
      if (eqIdx >= 0) {
        const k = raw.slice(0, eqIdx);
        const v = raw.slice(eqIdx + 1);
        flags[k] = v;
        continue;
      }

      const k = raw;
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        flags[k] = next;
        i++;
      } else {
        flags[k] = true;
      }
      continue;
    }

    positionals.push(a);
  }

  return { positionals, flags };
}

function getFlag(flags: Record<string, string | boolean>, name: string): string | undefined {
  const v = flags[name];
  return typeof v === 'string' ? v : undefined;
}

function hasFlag(flags: Record<string, string | boolean>, name: string): boolean {
  return Boolean(flags[name]);
}

function usage(exitCode = 0) {
  const msg = `jooja-auth-hub-client

Usage:
  jooja-auth-hub-client health [--base-url <url>]

  # Google connect
  jooja-auth-hub-client google connect-url --principal-id <uuid> [--scopes "scope1 scope2"]
  jooja-auth-hub-client google status --principal-id <uuid>

  # Token retrieval (preferred: per-principal clientSecret)
  jooja-auth-hub-client token get --providerId <provider> [--principal-id <uuid>] [--client-secret <secret>] [--min-ttl-sec 120] [--force-refresh]

  # Admin
  jooja-auth-hub-client admin stats [--admin-api-key <key>]
  jooja-auth-hub-client admin tokens [--providerId google] [--principalId <uuid>] [--admin-api-key <key>]
  jooja-auth-hub-client admin principals [--admin-api-key <key>]
  jooja-auth-hub-client admin principal create [--display-name "Ilia"] [--legacy-principal-ref "telegram:540443"] [--admin-api-key <key>]

Env vars:
  AUTH_HUB_BASE_URL         (default http://127.0.0.1:8787)
  AUTH_HUB_ADMIN_API_KEY    (optional; for /v1/admin/*)

  # v2 identity (preferred)
  AUTH_HUB_PRINCIPAL_ID     (uuid)
  AUTH_HUB_CLIENT_SECRET    (secret)

  # legacy shared bearer token mode (optional)
  AUTH_HUB_BEARER_TOKEN

Examples:
  # Health
  jooja-auth-hub-client health

  # Create a new principal (admin)
  jooja-auth-hub-client admin principal create --display-name "Ilia" --legacy-principal-ref "telegram:540443"

  # Get a connect URL
  jooja-auth-hub-client google connect-url --principal-id <uuid>

  # Get a Google access token
  jooja-auth-hub-client token get --providerId google --principal-id <uuid> --client-secret <secret>
`;

  // eslint-disable-next-line no-console
  console.log(msg);
  process.exit(exitCode);
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  if (positionals.length === 0 || hasFlag(flags, 'help') || hasFlag(flags, 'h')) usage(0);

  const baseUrl = (getFlag(flags, 'base-url') ?? process.env.AUTH_HUB_BASE_URL ?? 'http://127.0.0.1:8787').replace(
    /\/+$/,
    ''
  );
  const adminApiKey = getFlag(flags, 'admin-api-key') ?? process.env.AUTH_HUB_ADMIN_API_KEY;

  const principalId = getFlag(flags, 'principal-id') ?? process.env.AUTH_HUB_PRINCIPAL_ID;
  const clientSecret = getFlag(flags, 'client-secret') ?? process.env.AUTH_HUB_CLIENT_SECRET;

  // legacy
  const bearerToken = getFlag(flags, 'bearer-token') ?? process.env.AUTH_HUB_BEARER_TOKEN;

  const client = new AuthHubClient({ baseUrl, adminApiKey, principalId, clientSecret, bearerToken });

  const [cmd1, cmd2, cmd3] = positionals;

  if (cmd1 === 'health') {
    const res = await client.health();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd1 === 'google' && cmd2 === 'connect-url') {
    const pid = principalId ?? getFlag(flags, 'principal-id');
    if (!pid) throw new Error('Missing --principal-id (or AUTH_HUB_PRINCIPAL_ID)');

    const scopes = getFlag(flags, 'scopes');
    const url = await client.googleConnectUrl({ principalId: pid, scopes });
    // eslint-disable-next-line no-console
    console.log(url);
    return;
  }

  if (cmd1 === 'google' && cmd2 === 'status') {
    const pid = principalId ?? getFlag(flags, 'principal-id');
    if (!pid) throw new Error('Missing --principal-id (or AUTH_HUB_PRINCIPAL_ID)');

    const res = await client.googleStatus({ principalId: pid });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd1 === 'admin' && cmd2 === 'stats') {
    const res = await client.adminStats();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd1 === 'admin' && cmd2 === 'tokens') {
    const providerId = getFlag(flags, 'providerId');
    const p = getFlag(flags, 'principalId');
    const res = await client.adminTokens({ providerId, principalId: p });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd1 === 'admin' && cmd2 === 'principals') {
    const res = await client.adminPrincipals();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd1 === 'admin' && cmd2 === 'principal' && cmd3 === 'create') {
    const displayName = getFlag(flags, 'display-name');
    const legacyPrincipalRef = getFlag(flags, 'legacy-principal-ref');

    const res = await client.adminCreatePrincipal({ displayName, legacyPrincipalRef });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd1 === 'token' && cmd2 === 'get') {
    const providerId = getFlag(flags, 'providerId');
    if (!providerId) throw new Error('Missing --providerId');

    const pid = principalId ?? getFlag(flags, 'principal-id');
    const secret = clientSecret ?? getFlag(flags, 'client-secret');
    if (!pid) throw new Error('Missing --principal-id (or AUTH_HUB_PRINCIPAL_ID)');
    if (!secret) throw new Error('Missing --client-secret (or AUTH_HUB_CLIENT_SECRET)');

    const minTtlSecRaw = getFlag(flags, 'min-ttl-sec');
    const minTtlSec = minTtlSecRaw ? Number(minTtlSecRaw) : undefined;
    const forceRefresh = hasFlag(flags, 'force-refresh');

    const res = await client.tokenAccess({ principalId: pid, clientSecret: secret, providerId, minTtlSec, forceRefresh });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  // Unknown command
  usage(1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(String(err?.stack ?? err));
  process.exit(1);
});
