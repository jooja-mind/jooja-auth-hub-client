# Jooja Quick Auth (JQA) — Instructions for AI Agents

This doc is for **other AI agents / internal automation** that need provider access tokens (for example Google, Apple Music, Notion, LinkedIn, GitHub, Microsoft, or Discord) without directly handling OAuth refresh tokens.

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

For a new project, preferred practical flow:
1. Look for an existing UUID+secret in saved local secrets first.
2. If none exists, ask the user/operator for them.
3. Create a project `.env` file.
4. Put `JQA_UUID`, `JQA_SECRET`, `JQA_PROVIDER`, and optionally `JQA_BASE_URL` there.
5. In code, start with `const accessToken = await getAccessTokenFromEnv();`.

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
export JQA_SECRET="..."
export JQA_PROVIDER="google"

jqa connect-url
```

Send the printed URL to the human. They must open it in a browser and complete consent.

If the JQA server changed requested scopes for that provider, generate a fresh connect URL and have the human reconnect so the new grant is actually issued.

Verify token presence:

```bash
jqa status
```

Expected: `hasToken: true`.

For Apple Music, after the human finishes the MusicKit page, also verify token retrieval with:

```bash
jqa token --provider applemusic --json
```

That response includes both:
- `accessToken` - Apple Music Developer Token
- `musicUserToken` - Apple Music Music User Token

For LinkedIn, OAuth success only means the access token was stored. Posting or other advanced APIs can still require separate LinkedIn product approval.

For GitHub, whether JQA can refresh tokens depends on your GitHub OAuth App configuration (some apps issue non-expiring tokens; others issue expiring tokens with refresh_token).

For Microsoft and Discord, refresh token support typically depends on the `offline_access` scope being granted during connect.

For Google, a server may request sensitive/restricted scopes such as Gmail, Meet, Presentations, or YouTube-related scopes depending on how its connect preset is configured. If that preset changes, reconnect to refresh the granted scope set.

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

For Apple Music, prefer JSON because the response contains two tokens (`accessToken` and `musicUserToken`).

For Notion and LinkedIn, plain `jqa token` is usually fine unless you want expiry/source metadata for debugging.

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
