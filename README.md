# jooja-auth-hub-client

Companion **client + micro-CLI** for `jooja-auth-hub`.

Goal: give other internal scripts/agents a single, boring way to:
- check hub health
- generate a **human** OAuth connect URL (Google)
- check whether a principal already has a token stored (status)
- (admin-only) view token metadata/stats
- request a **short-lived provider access token** from the hub (Google, MVP)

As of v2, the hub uses a safer identity model:
- `principalId` — server-issued UUID
- `clientSecret` — per-principal secret used for authenticated token retrieval

Token retrieval returns **access tokens only** (refresh tokens never leave the hub).

## Contract / API surface (v2)

The client assumes the hub endpoints:

- Health:
  - `GET /health` → `{ ok: true }`

- Principal issuance (admin-only):
  - `POST /v1/admin/principals` → `{ principalId, clientSecret, ... }`

- Google connect:
  - `GET /v1/providers/google/auth/start?principalId=<uuid>[&scopes=...]`
    - default: **redirect** to Google
    - when `Accept: application/json`: returns `{ url: "https://accounts.google.com/..." }`
  - `GET /auth/google/callback` (browser redirect target)

- Google token status:
  - `GET /v1/providers/google/status?principalId=<uuid>` → `{ hasToken, updatedAt, ... }`

- Token retrieval (preferred, per-principal Basic auth):
  - `POST /v1/tokens/access`
    - `Authorization: Basic base64(<principalId>:<clientSecret>)`

- Admin (optional):
  - `GET /v1/admin/stats` (requires `x-api-key` when the hub has `ADMIN_API_KEY`)
  - `GET /v1/admin/tokens?providerId=...&principalId=...` (never returns token contents)
  - `GET /v1/admin/principals` (never returns secret verification material)

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
- `AUTH_HUB_PRINCIPAL_ID` (UUID)
- `AUTH_HUB_CLIENT_SECRET` (secret)
- `AUTH_HUB_ADMIN_API_KEY` (optional; only for admin endpoints)

## CLI usage

Build once:

```bash
npm run build
```

Then:

```bash
node dist/cli.js health

# (admin) issue a principal (prints principalId + clientSecret)
node dist/cli.js admin principal create --display-name "Ilia" --legacy-principal-ref "telegram:540443"

# generate a Google connect URL (send it to a human)
node dist/cli.js google connect-url --principal-id <uuid>

# status
node dist/cli.js google status --principal-id <uuid>

# get a Google access token (Basic auth)
node dist/cli.js token get --providerId google --principal-id <uuid> --client-secret <secret>
```

Admin endpoints:

```bash
node dist/cli.js admin stats --admin-api-key "$AUTH_HUB_ADMIN_API_KEY"
node dist/cli.js admin tokens --admin-api-key "$AUTH_HUB_ADMIN_API_KEY" --providerId google
node dist/cli.js admin principals --admin-api-key "$AUTH_HUB_ADMIN_API_KEY"
```

## Curl examples

Health:

```bash
curl -s "$AUTH_HUB_BASE_URL/health" | jq
```

Get a Google connect URL (non-redirect JSON response):

```bash
curl -s \
  -H 'Accept: application/json' \
  "$AUTH_HUB_BASE_URL/v1/providers/google/auth/start?principalId=$AUTH_HUB_PRINCIPAL_ID" | jq -r .url
```

Status:

```bash
curl -s \
  "$AUTH_HUB_BASE_URL/v1/providers/google/status?principalId=$AUTH_HUB_PRINCIPAL_ID" | jq
```

Get an access token (Basic auth):

```bash
curl -s \
  -H "Authorization: Basic $(printf '%s:%s' "$AUTH_HUB_PRINCIPAL_ID" "$AUTH_HUB_CLIENT_SECRET" | base64)" \
  -H 'content-type: application/json' \
  -d '{"providerId":"google","minTtlSec":120}' \
  "$AUTH_HUB_BASE_URL/v1/tokens/access" | jq
```

## Security notes

- Treat `AUTH_HUB_CLIENT_SECRET` like a password.
- Do not log authorization headers.
- The hub is a token vault. Don’t expose it to the public internet without protections.

See `AGENT.md` for stricter operational rules.
