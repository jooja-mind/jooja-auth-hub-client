# jooja-auth-hub-client

Companion **client + micro-CLI** for [`jooja-auth-hub`](../jooja-auth-hub).

Goal: give other internal scripts/agents a single, boring way to:
- check hub health
- generate a **human** OAuth connect URL (Google)
- check whether a principal already has a token stored (status)
- (admin-only) view token metadata/stats
- (future) call a strongly-authenticated token retrieval endpoint (placeholder only)

This repo intentionally does **not** include any token retrieval logic for v0, because the hub does not expose it yet.

## Contract / API surface (v0)

The client assumes the current hub endpoints:

- Health:
  - `GET /health` → `{ ok: true }`
- Google connect:
  - `GET /auth/google/start?principal=<kind:id>[&scopes=...]`
    - default behavior: **redirect** to Google
    - when `Accept: application/json`: returns `{ url: "https://accounts.google.com/..." }`
  - `GET /auth/google/callback` (browser redirect target)
- Google token status:
  - `GET /v1/providers/google/status?principal=<kind:id>` → `{ hasToken, updatedAt, ... }`
- Admin (optional):
  - `GET /v1/admin/stats` (requires `x-api-key` when the hub has `ADMIN_API_KEY`)
  - `GET /v1/admin/tokens?providerId=...&principalId=...` (never returns token contents)

More detail: see `docs/contract.md`.

## Setup

### Requirements

- Node.js >= 20

### Install

```bash
cd /home/powerdot/node/jooja-auth-hub-client
npm install
npm run build
```

### Configure env

```bash
cp .env.example .env
# edit .env
```

Key env vars:
- `AUTH_HUB_BASE_URL` (default: `http://127.0.0.1:8787`)
- `AUTH_HUB_PRINCIPAL` (optional default for CLI)
- `AUTH_HUB_ADMIN_API_KEY` (optional; only for admin endpoints)

## CLI usage

Build once:

```bash
npm run build
```

Then:

```bash
node dist/cli.js health
node dist/cli.js google connect-url --principal telegram:540443
node dist/cli.js google status --principal telegram:540443
```

Admin endpoints:

```bash
node dist/cli.js admin stats --admin-api-key "$AUTH_HUB_ADMIN_API_KEY"
node dist/cli.js admin tokens --admin-api-key "$AUTH_HUB_ADMIN_API_KEY" --providerId google
```

## Curl examples (useful for other repos)

Health:

```bash
curl -s "$AUTH_HUB_BASE_URL/health" | jq
```

Get a Google connect URL (non-redirect JSON response):

```bash
curl -s \
  -H 'Accept: application/json' \
  "$AUTH_HUB_BASE_URL/auth/google/start?principal=telegram:540443" | jq -r .url
```

Status:

```bash
curl -s \
  "$AUTH_HUB_BASE_URL/v1/providers/google/status?principal=telegram:540443" | jq
```

## Intended workflow for other agents/tools

1. Pick a **principal** (currently `kind:id`, e.g. `telegram:540443`).
2. If status says `hasToken: false`, send the user a connect URL to open in a browser.
3. After the callback succeeds, poll status again until `hasToken: true`.
4. (Future) request an access token/refresh token via a proper authenticated endpoint.

## Security notes (read this)

- Treat `AUTH_HUB_ADMIN_API_KEY` as sensitive.
- Do not log URLs that might contain secrets in the future.
- The hub is a token vault. Don’t expose it to the public internet without protections.

See `AGENT.md` for stricter operational rules.
