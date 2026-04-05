#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_JQA_BASE_URL, JqaClient } from './client.js';
import { loadJqaEnv } from './env.js';

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

    if (a.startsWith('-') && a.length > 1) {
      // minimal short-flag support: -h / -v
      if (a === '-h') flags.h = true;
      else if (a === '-v') flags.v = true;
      else positionals.push(a);
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

function die(msg: string, code = 1): never {
  // eslint-disable-next-line no-console
  console.error(msg);
  process.exit(code);
}

function getVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function usage(exitCode = 0) {
  const msg = `jqa — Jooja Quick Auth CLI

Usage:
  jqa token [--provider <id>] [--uuid <uuid>] [--secret <secret>] [--min-ttl-sec 120] [--force-refresh] [--json]
  jqa connect-url [--provider <id>] [--uuid <uuid>] [--secret <secret>] [--scopes "scope1 scope2"]
  jqa status [--provider <id>] [--uuid <uuid>] [--secret <secret>]
  jqa health

  # Admin (issues a new UUID+secret)
  jqa admin principal create [--display-name "Ilia"] [--legacy-principal-ref "telegram:540443"] [--admin-api-key <key>]

Env (recommended):
  JQA_UUID
  JQA_SECRET
  JQA_PROVIDER

Optional overrides:
  JQA_BASE_URL        (default: ${DEFAULT_JQA_BASE_URL})
  JQA_ADMIN_API_KEY   (admin-only)

Notes:
  - token prints the raw access token by default (good for scripts).
  - use --json to print the full response object.
`;

  // eslint-disable-next-line no-console
  console.log(msg);
  process.exit(exitCode);
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  if (positionals.length === 0 || hasFlag(flags, 'help') || hasFlag(flags, 'h')) usage(0);
  if (hasFlag(flags, 'version') || hasFlag(flags, 'v')) {
    // eslint-disable-next-line no-console
    console.log(getVersion());
    return;
  }

  const cfg = loadJqaEnv(process.env);

  const baseUrl = (getFlag(flags, 'base-url') ?? cfg.baseUrl ?? DEFAULT_JQA_BASE_URL).replace(/\/+$/, '');
  const uuid = getFlag(flags, 'uuid') ?? getFlag(flags, 'principal-id') ?? cfg.uuid;
  const secret = getFlag(flags, 'secret') ?? getFlag(flags, 'client-secret') ?? cfg.secret;
  let providerId = getFlag(flags, 'provider') ?? getFlag(flags, 'providerId') ?? cfg.provider;
  const adminApiKey = getFlag(flags, 'admin-api-key') ?? cfg.adminApiKey;

  const client = new JqaClient({ baseUrl, uuid, secret, adminApiKey, bearerToken: cfg.bearerToken });

  let [cmd1, cmd2, cmd3] = positionals;

  // Backwards-ish compatibility for older patterns:
  //   jqa google connect-url
  //   jqa google status
  if (cmd2 === 'connect-url' || cmd2 === 'status') {
    if (!providerId) providerId = cmd1;
    cmd1 = cmd2;
    cmd2 = cmd3;
  }

  if (cmd1 === 'health') {
    const res = await client.health();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd1 === 'connect-url') {
    if (!providerId) die('Missing provider id (set JQA_PROVIDER or pass --provider)');
    if (!uuid) die('Missing uuid (set JQA_UUID or pass --uuid)');
    if (!secret) die('Missing secret (set JQA_SECRET or pass --secret)');

    const scopes = getFlag(flags, 'scopes');
    const url = await client.connectUrl({ providerId, uuid, secret, scopes });
    // eslint-disable-next-line no-console
    console.log(url);
    return;
  }

  if (cmd1 === 'status') {
    if (!providerId) die('Missing provider id (set JQA_PROVIDER or pass --provider)');
    if (!uuid) die('Missing uuid (set JQA_UUID or pass --uuid)');
    if (!secret) die('Missing secret (set JQA_SECRET or pass --secret)');

    const res = await client.status({ providerId, uuid, secret });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd1 === 'token' || cmd1 === 'access-token') {
    if (!providerId) die('Missing provider id (set JQA_PROVIDER or pass --provider)');
    if (!uuid) die('Missing uuid (set JQA_UUID or pass --uuid)');
    if (!secret) die('Missing secret (set JQA_SECRET or pass --secret)');

    const minTtlSecRaw = getFlag(flags, 'min-ttl-sec');
    const minTtlSec = minTtlSecRaw ? Number(minTtlSecRaw) : undefined;
    if (minTtlSecRaw && Number.isNaN(minTtlSec ?? NaN)) die('Invalid --min-ttl-sec (expected number)');

    const forceRefresh = hasFlag(flags, 'force-refresh');

    const res = await client.tokenAccess({ providerId, uuid, secret, minTtlSec, forceRefresh });

    if (hasFlag(flags, 'json')) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(res, null, 2));
    } else {
      // stdout-friendly: token only
      // eslint-disable-next-line no-console
      console.log(res.accessToken);
    }

    return;
  }

  if (cmd1 === 'admin' && cmd2 === 'principal' && cmd3 === 'create') {
    const displayName = getFlag(flags, 'display-name');
    const legacyPrincipalRef = getFlag(flags, 'legacy-principal-ref');

    if (!adminApiKey) die('Missing admin API key (set JQA_ADMIN_API_KEY or pass --admin-api-key)');

    const res = await client.adminCreatePrincipal({ displayName, legacyPrincipalRef });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  usage(1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(String(err?.stack ?? err));
  process.exit(1);
});
