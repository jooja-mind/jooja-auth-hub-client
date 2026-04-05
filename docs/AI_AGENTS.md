# Jooja Quick Auth (JQA) — Instructions for AI Agents

This doc is for **other AI agents / internal automation** that need provider access tokens (Google, etc.) without directly handling OAuth refresh tokens.

JQA is a token vault:
- humans do the consent flow once
- refresh tokens stay inside JQA
- agents request **short-lived access tokens** on demand

## 0) What you need

A credential pair issued by JQA:
- `JQA_UUID` (principal UUID)
- `JQA_SECRET` (per-principal secret)

And the provider you want:
- `JQA_PROVIDER` (example: `google`)

Optional:
- `JQA_BASE_URL` only if you are not using the default public deployment

## 1) Getting initial credentials (UUID + secret)

You obtain credentials via the **JQA admin flow**.

There are two common patterns:

### A) Use the CLI (admin-only)

Requires an admin API key (`JQA_ADMIN_API_KEY`). Then:

```bash
jqa admin principal create \
  --display-name "<human name>" \
  --legacy-principal-ref "<optional legacy ref>"
```

The response includes `principalId` and `clientSecret`.

Map them to env vars:
- `principalId` → `JQA_UUID`
- `clientSecret` → `JQA_SECRET`

### B) Ask an operator (recommended for most agents)

If you do not have admin access, request a UUID+secret pair from the operator who manages JQA.

## 2) Authorize a human for first use (connect URL)

Once you have `JQA_UUID` and `JQA_PROVIDER`, generate the connect URL:

```bash
export JQA_UUID="..."
export JQA_PROVIDER="google"

jqa connect-url
```

Send the printed URL to the human. They must open it in a browser and complete consent.

Verify token presence:

```bash
jqa status
```

Expected: `hasToken: true`.

## 3) Store credentials locally (outside git)

Never commit secrets.

Recommended:

1) Create a local secrets file (outside the repo), for example:

```bash
mkdir -p ~/.config/jooja-quick-auth
nano ~/.config/jooja-quick-auth/env
chmod 600 ~/.config/jooja-quick-auth/env
```

2) Put only the minimum:

```bash
export JQA_UUID="..."
export JQA_SECRET="..."
export JQA_PROVIDER="google"
# export JQA_BASE_URL="http://127.0.0.1:8787"  # optional override only
```

3) Source it when needed:

```bash
source ~/.config/jooja-quick-auth/env
```

## 4) Use the CLI to obtain access tokens

Token-only output (best for scripting):

```bash
token="$(jqa token)"
```

Full JSON (includes expiry metadata):

```bash
jqa token --json
```

Force refresh:

```bash
jqa token --force-refresh
```

## 5) Use the library API

```js
import { getAccessTokenFromEnv } from 'jooja-quick-auth';

const token = await getAccessTokenFromEnv();
```

## Security rules (non-negotiable)

- Treat `JQA_SECRET` like a password.
- Do not paste tokens into chat logs or tickets.
- Do not print credentials in debug logs.
- Prefer piping tokens directly into the process that needs them.
- Assume the network is hostile: handle non-200/non-JSON responses.
