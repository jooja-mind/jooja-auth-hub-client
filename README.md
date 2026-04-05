# jooja-quick-auth

**Jooja Quick Auth (JQA)** client library + CLI for obtaining **short-lived provider access tokens** from the JQA service.

- Default service URL is built-in: `https://jooja-auth.leverton.dev`
- You only set `JQA_BASE_URL` if you need to override it (local/dev/alt deploy)

## Install

### As a library

```bash
npm i jooja-quick-auth
```

### As an npx tool

```bash
# Run the CLI without installing globally
npx -p jooja-quick-auth jqa --help
```

(If/when published, you can also use `npx jooja-quick-auth ...` because the package exports that bin name too.)

## Env contract (recommended)

Required:
- `JQA_UUID` — your JQA principal UUID
- `JQA_SECRET` — your per-principal secret
- `JQA_PROVIDER` — provider id (e.g. `google`)

Optional overrides:
- `JQA_BASE_URL` — override service base URL (default is public)
- `JQA_ADMIN_API_KEY` — admin-only endpoints

Example (do **not** commit real values):

```bash
export JQA_UUID="..."
export JQA_SECRET="..."
export JQA_PROVIDER="google"
```

## CLI usage

```bash
# Health
jqa health

# First-time human authorization (send this URL to the human)
jqa connect-url

# See if a token is stored already
jqa status

# Get a short-lived access token (prints token only)
jqa token

# Full JSON response
jqa token --json

# Force refresh
jqa token --force-refresh
```

Overriding from flags:

```bash
jqa token --provider google --uuid "$JQA_UUID" --secret "$JQA_SECRET"
```

## Library usage

```js
import { JqaClient, getAccessTokenFromEnv } from 'jooja-quick-auth';

// simplest
const token = await getAccessTokenFromEnv();

// full control
const client = new JqaClient({ uuid: process.env.JQA_UUID, secret: process.env.JQA_SECRET });
const res = await client.tokenAccess({ providerId: 'google', minTtlSec: 120 });
console.log(res.accessToken);
```

## For AI agents / automation (important)

See: **`docs/AI_AGENTS.md`**

It explains:
- how to obtain initial `JQA_UUID` + `JQA_SECRET` (admin flow)
- how to authorize a human for first use
- how to store credentials locally outside git
- how to use the CLI/library safely

## Security notes (read)

- Treat `JQA_SECRET` like a password.
- Treat `JQA_UUID` + `JQA_SECRET` together as a credential pair.
- **Do not commit** secrets or tokens.
- Avoid pasting tokens into chat logs; prefer piping to the process that needs it.
