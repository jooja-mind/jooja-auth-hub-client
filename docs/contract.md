# Jooja Quick Auth (JQA) Client Contract

This document is written for **other internal scripts/agents**.

> If you change JQA routes, update this file *and* `README.md`.

## Base URL

- Default public deployment: `https://jooja-auth.leverton.dev`
- Local dev (example): `http://127.0.0.1:8787`

Client default should be the public deployment; override only when needed.

## Identity model (UUID + secret)

### Principal (aka UUID)

A **principal** is *who the tokens belong to*.

In v2, principals are server-issued and opaque:

- `principalId` — UUID (we call it `uuid` in client env)
- `clientSecret` — secret (we call it `secret` in client env)

The service stores secret verification material; the secret is only returned once at issuance/rotation time.

### Auth: Basic

For per-principal token retrieval, clients authenticate with HTTP Basic:

```
Authorization: Basic base64(<principalId>:<clientSecret>)
```

Notes:
- treat the secret like a password
- do not log Basic headers

## Health

### `GET /health`

Response:

```json
{ "ok": true }
```

## Providers

Provider routes are namespaced by provider id.

### Start OAuth (connect URL): `GET /v1/providers/:providerId/auth/start`

Query:
- `principalId` (required, UUID)
- `scopes` (optional) — space or comma separated

Behavior:
- default: HTTP redirect to provider consent page
- when `Accept: application/json`: returns JSON

JSON response:

```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }
```

### Callback: `GET /auth/:providerId/callback`

This is a browser endpoint. On success JQA stores the token envelope.

### Status: `GET /v1/providers/:providerId/status`

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
- If the stored token has no `refresh_token`, the service may respond with `409 reauth_required`.

## Admin endpoints (optional)

If configured with `ADMIN_API_KEY`, calls must include:

```
x-api-key: <ADMIN_API_KEY>
```

### `GET /v1/admin/stats`

Returns counts (shape may evolve).

### `GET /v1/admin/tokens`

Query (optional):
- `providerId`
- `principalId`

Never returns token contents.

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
