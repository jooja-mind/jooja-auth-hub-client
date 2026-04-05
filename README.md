# jooja-quick-auth

`jooja-quick-auth` is a small client for **Jooja Quick Auth (JQA)**.

Its job is simple:
- talk to the JQA server
- ask for a short-lived access token for some provider
- give that token to your script, tool, or AI agent

Providers (MVP):
- `google` (OAuth)
- `applemusic` (MusicKit JS connect; token response includes an extra `musicUserToken` field)

Default JQA server:
- `https://jooja-auth.leverton.dev`

You do **not** need to set the base URL unless you want to override it.

---

## 1. What this is

This package solves one annoying problem:

You want a project or an AI agent to work with Google Drive / Calendar / Sheets, but you do **not** want every project to reimplement OAuth, token refresh, callback handling, and secret storage from scratch.

So instead:
- a user authorizes once through JQA
- the client gets a short-lived provider access token from JQA
- your script/tool uses that token with the provider API

Think of this package as:
- a **tiny auth helper** for apps and agents
- plus a **CLI** for quick manual use

---

## 2. When to use the CLI

Use the CLI when you want something quick and practical, for example:
- check that JQA is alive
- generate a connect URL for a human
- check whether authorization already exists
- print an access token for a shell script or one-off command

Good CLI use cases:
- testing setup
- quick local scripts
- shell automation
- debugging an integration

### Install / run the CLI

This package is currently meant to be consumed **from GitHub**, not from the npm registry.

#### Install from GitHub

```bash
npm i github:jooja-mind/jooja-auth-hub-client
```

Then use the bin:

```bash
npx jqa --help
```

You can also call the alias directly:

```bash
npx jooja-quick-auth --help
```

#### One-off use without adding it to package.json

```bash
npx github:jooja-mind/jooja-auth-hub-client jqa --help
```

---

## 3. CLI commands

If the package is installed from GitHub in a project, examples below still work the same way:

```bash
npx jqa health
npx jqa connect-url
npx jqa token
```

### Health check

```bash
jqa health
```

Checks whether the JQA server is reachable.

### Generate a connect URL

```bash
jqa connect-url
```

This uses your configured `JQA_UUID` + `JQA_SECRET` (Basic-authenticated), not a Telegram id or any guessable principal string.

Use this when a human needs to connect a provider account for the first time.

### Check provider status

```bash
jqa status
```

Shows whether JQA already has token material for the current provider.

### Get an access token

```bash
jqa token
```

Prints a short-lived access token only.

### Get full token response as JSON

```bash
jqa token --json
```

Useful for debugging.

#### Apple Music note

Apple Music needs **two** tokens:
- Developer Token (JWT): returned as `accessToken`
- Music User Token: returned as `musicUserToken`

So for `--provider applemusic` you almost always want `--json`.

### Force token refresh

```bash
jqa token --force-refresh
```

### Override values from flags

```bash
jqa token \
  --provider google \
  --uuid "$JQA_UUID" \
  --secret "$JQA_SECRET"
```

---

## 4. When to use it as a package

Use the package API when you are writing:
- a Node.js project
- a reusable tool
- an AI agent integration
- a script that should fetch tokens programmatically

This is the better option when:
- you do not want to shell out to a CLI
- you want cleaner code
- you want to fetch a token inside your app flow

---

## 5. How to use it as a package

### Install

Install directly from GitHub:

```bash
npm i github:jooja-mind/jooja-auth-hub-client
```

If you prefer package.json syntax explicitly:

```json
{
  "dependencies": {
    "jooja-quick-auth": "github:jooja-mind/jooja-auth-hub-client"
  }
}
```

### Simplest usage

```js
import { getAccessTokenFromEnv } from 'jooja-quick-auth';

const token = await getAccessTokenFromEnv();
console.log(token);
```

This is the same import shape even when the package is installed from GitHub.

This reads config from env variables.

### Full client usage

```js
import { JqaClient } from 'jooja-quick-auth';

const client = new JqaClient({
  uuid: process.env.JQA_UUID,
  secret: process.env.JQA_SECRET,
  baseUrl: process.env.JQA_BASE_URL, // optional
});

const result = await client.tokenAccess({
  providerId: process.env.JQA_PROVIDER || 'google',
  minTtlSec: 120,
});

console.log(result.accessToken);
```

---

## 6. Required environment variables

### Required

- `JQA_UUID`
  - your JQA principal UUID
- `JQA_SECRET`
  - your JQA client secret
- `JQA_PROVIDER`
  - provider name, for example `google` or `applemusic`

### Optional

- `JQA_BASE_URL`
  - override JQA base URL
  - default is already built in:
    - `https://jooja-auth.leverton.dev`
- `JQA_ADMIN_API_KEY`
  - only needed for admin flows

### Example

```bash
export JQA_UUID="..."
export JQA_SECRET="..."
export JQA_PROVIDER="google"
```

Or put them in a local `.env` / secret file outside git and let your project load them.

### Recommended storage

For real projects and agents, store these in a local secret/env file outside git, for example:
- `~/.config/jooja-auth-hub-client/env`
- or your agent's own secret path

Do **not** commit real values.

---

## 7. Typical workflow

### First-time setup

1. Get `JQA_UUID` and `JQA_SECRET`
2. Store them locally outside git
3. Generate a connect URL:

```bash
jqa connect-url
```

4. Send that URL to the human
5. Human completes authorization
   - Google: standard OAuth consent screen
   - Apple Music: JQA-hosted MusicKit page (Apple login in-browser)
6. Check status:

```bash
jqa status
```

7. Start requesting access tokens with `jqa token` or the package API

### Ongoing use

After first authorization, your project or agent usually only needs:
- `JQA_UUID`
- `JQA_SECRET`
- `JQA_PROVIDER`

Then it can ask JQA for short-lived access tokens whenever needed.

---

## 8. Typical project setup from GitHub

A realistic project setup looks like this:

```bash
npm i github:jooja-mind/jooja-auth-hub-client
```

```env
JQA_UUID=...
JQA_SECRET=...
JQA_PROVIDER=google
```

```js
import { getAccessTokenFromEnv } from 'jooja-quick-auth';

const accessToken = await getAccessTokenFromEnv();
```

Then use that access token against the provider API you need.

## 9. For AI agents

If this package is being used by another AI agent, read:
- `docs/AI_AGENTS.md`

That file explains:
- how to get initial credentials
- how to onboard a human
- how to store secrets safely
- how to use the package/CLI without leaking tokens

---

## 10. Security notes

- Treat `JQA_SECRET` like a password.
- Treat `JQA_UUID` + `JQA_SECRET` together as a credential pair.
- Do **not** commit secrets or tokens.
- Do not dump tokens into logs or chat unless absolutely necessary.
- Prefer piping the token directly into the process that needs it.
