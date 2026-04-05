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
  jooja-auth-hub-client google connect-url --principal <kind:id> [--scopes "scope1 scope2"]
  jooja-auth-hub-client google status --principal <kind:id>
  jooja-auth-hub-client admin stats [--admin-api-key <key>]
  jooja-auth-hub-client admin tokens [--providerId google] [--principalId telegram:...] [--admin-api-key <key>]
  jooja-auth-hub-client token get --principalId <kind:id> --providerId <provider> [--min-ttl-sec 120] [--force-refresh]

Env vars:
  AUTH_HUB_BASE_URL         (default http://127.0.0.1:8787)
  AUTH_HUB_ADMIN_API_KEY    (optional; for /v1/admin/*)
  AUTH_HUB_PRINCIPAL        (optional; used when --principal is omitted)
  AUTH_HUB_BEARER_TOKEN     (required for /v1/tokens/* endpoints)

Examples:
  # Health
  jooja-auth-hub-client health

  # Get a connect URL (JSON mode behind the scenes)
  jooja-auth-hub-client google connect-url --principal telegram:540443

  # Check whether the principal has a Google token stored
  jooja-auth-hub-client google status --principal telegram:540443
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
  const bearerToken = getFlag(flags, 'bearer-token') ?? process.env.AUTH_HUB_BEARER_TOKEN;

  const client = new AuthHubClient({ baseUrl, adminApiKey, bearerToken });

  const [cmd1, cmd2, cmd3] = positionals;

  if (cmd1 === 'health') {
    const res = await client.health();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd1 === 'google' && cmd2 === 'connect-url') {
    const principal = getFlag(flags, 'principal') ?? process.env.AUTH_HUB_PRINCIPAL;
    if (!principal) throw new Error('Missing --principal (or AUTH_HUB_PRINCIPAL)');

    const scopes = getFlag(flags, 'scopes');
    const url = await client.googleConnectUrl({ principal, scopes });
    // eslint-disable-next-line no-console
    console.log(url);
    return;
  }

  if (cmd1 === 'google' && cmd2 === 'status') {
    const principal = getFlag(flags, 'principal') ?? process.env.AUTH_HUB_PRINCIPAL;
    if (!principal) throw new Error('Missing --principal (or AUTH_HUB_PRINCIPAL)');

    const res = await client.googleStatus({ principal });
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
    const principalId = getFlag(flags, 'principalId');
    const res = await client.adminTokens({ providerId, principalId });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd1 === 'token' && cmd2 === 'get') {
    const principalId = getFlag(flags, 'principalId');
    const providerId = getFlag(flags, 'providerId');
    if (!principalId) throw new Error('Missing --principalId');
    if (!providerId) throw new Error('Missing --providerId');

    const minTtlSecRaw = getFlag(flags, 'min-ttl-sec');
    const minTtlSec = minTtlSecRaw ? Number(minTtlSecRaw) : undefined;
    const forceRefresh = hasFlag(flags, 'force-refresh');

    const res = await client.tokenAccess({ principalId, providerId, minTtlSec, forceRefresh });
    if (res === null) {
      // eslint-disable-next-line no-console
      console.error('Token retrieval endpoint is not enabled on the hub (got 404). Is TOKEN_BEARER_TOKEN set on the hub?');
      process.exitCode = 2;
      return;
    }

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
