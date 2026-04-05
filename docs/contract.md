# Auth Hub Client Contract (v2)

This document is written for **other internal scripts/agents**.

> If you change the hub routes, update this file *and* `README.md`.

## Base URL

- Local dev (default): `http://127.0.0.1:8787`
- Current public deployment (as of April 2026): `https://jooja-auth.leverton.dev`

## Identity model

### Principal

A **principal** is *who the tokens belong to*.

In v2, principals are server-issued and opaque:

- `principalId` — UUID (public identifier)
- `clientSecret` — secret (used to authenticate token retrieval)

The hub stores secret verification material; the secret is only returned once at issuance/rotation time.

### Auth: Basic

For per-principal token retrieval, clients authenticate with HTTP Basic:

```
Authorization: Basic base64(<principalId>:<clientSecret>)
```

Notes:
- treat `clientSecret` like a password.
- do not log Basic headers.

## Health

### `GET /health`

Response:

```json
{ "ok": true }
```

## Google provider

### Start OAuth (connect URL): `GET /v1/providers/google/auth/start`

Query:
- `principalId` (required, UUID)
- `scopes` (optional) — space or comma separated

Behavior:
- default: HTTP redirect to Google
- when `Accept: application/json`: returns JSON

JSON response:

```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }
```

### Callback: `GET /auth/google/callback`

This is a browser endpoint. On success the hub stores the token envelope.

### Status: `GET /v1/providers/google/status`

Query:
- `principalId` (required, UUID)

Response:

```json
{
  "principalId": "9d6a6a6d-1fef-4f8c-bfcb-0b4fe4136d8a",
  "providerId": "google",
  "hasToken": true,
  "updatedAt": "2026-04-05T12:34:56.000Z"
}
```

## Admin endpoints (optional)

If the hub is configured with `ADMIN_API_KEY`, calls must include:

```
x-api-key: <ADMIN_API_KEY>
```

### `GET /v1/admin/stats`

Returns counts (shape may evolve):

```json
{
  "ok": true,
  "principals": 2,
  "tokens": 2,
  "byProvider": { "google": 2 }
}
```

### `GET /v1/admin/tokens`

Query (optional):
- `providerId`
- `principalId`

Response:

```json
[
  {
    "providerId": "google",
    "principalId": "9d6a6a6d-1fef-4f8c-bfcb-0b4fe4136d8a",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

### `POST /v1/admin/principals`

Creates a principal. Returns the `clientSecret` **only once**.

Body (all optional):

```json
{
  "displayName": "Ilia",
  "legacyPrincipalRef": "telegram:540443"
}
```

Response (201):

```json
{
  "principalId": "9d6a6a6d-1fef-4f8c-bfcb-0b4fe4136d8a",
  "clientSecret": "...",
  "createdAt": "...",
  "displayName": "Ilia",
  "legacyPrincipalRef": "telegram:540443"
}
```

### Migration helper: `POST /v1/admin/migrate/tokens`

Moves tokens from an old principal key (e.g. `telegram:540443`) to a UUID principal.

Body:

```json
{
  "fromPrincipalId": "telegram:540443",
  "toPrincipalId": "9d6a6a6d-1fef-4f8c-bfcb-0b4fe4136d8a"
}
```

## Token retrieval (v2)

These endpoints return a **short-lived access token** (never the refresh token).

### `POST /v1/tokens/access`

Auth:

```
Authorization: Basic base64(<principalId>:<clientSecret>)
```

Request body:

```json
{
  "providerId": "google",
  "minTtlSec": 120,
  "forceRefresh": false
}
```

Response:

```json
{
  "ok": true,
  "providerId": "google",
  "principalId": "9d6a6a6d-1fef-4f8c-bfcb-0b4fe4136d8a",
  "tokenType": "Bearer",
  "scope": "...",
  "accessToken": "ya29...",
  "issuedAt": "2026-04-05T12:34:56.000Z",
  "expiresAt": "2026-04-05T13:34:56.000Z",
  "source": "cache"
}
```

Notes:
- Currently only `providerId=google` is supported.
- If the stored token has no `refresh_token`, the hub responds with `409 reauth_required`.

## Legacy bearer-mode token retrieval (optional)

The hub may still accept:

```
Authorization: Bearer <TOKEN_BEARER_TOKEN>
```

…if `TOKEN_BEARER_TOKEN` is configured on the hub.

This exists for transition only; prefer v2 Basic auth.
