# Auth Hub Client Contract (v0)

This document is written for **other internal scripts/agents**.

> If you change the hub routes, update this file *and* `README.md`.

## Base URL

- Local dev (default): `http://127.0.0.1:8787`
- Current public deployment (as of April 2026): `https://jooja-auth.leverton.dev`

## Principal format

A principal identifies *who the token belongs to*.

Current MVP format is a string:

```
<kind>:<id>
```

Examples:
- `telegram:540443` (Telegram user)
- `telegram-chat:-1001234567890` (Telegram group/channel)

Notes:
- The hub normalizes this value server-side.
- Treat principal IDs as semi-sensitive metadata (don’t spray them into logs).

## Health

### `GET /health`

Response:

```json
{ "ok": true }
```

## Google provider

### Start OAuth: `GET /auth/google/start`

Query:
- `principal` (required)
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
- `principal` (required)

Response:

```json
{
  "principalId": "telegram:540443",
  "providerId": "google",
  "hasToken": true,
  "updatedAt": "2026-04-05T12:34:56.000Z"
}
```

## Admin endpoints (optional)

These endpoints exist for debugging/ops and never return token contents.

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
    "principalId": "telegram:540443",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

## Token retrieval (NOT in v0)

The hub intentionally does **not** expose token contents in v0.

This client repo includes a placeholder method/CLI command that attempts:

- `GET /v1/tokens/get?principalId=...&providerId=...`

…but you should expect **404** until the hub grows a real, strongly-authenticated token retrieval story.
