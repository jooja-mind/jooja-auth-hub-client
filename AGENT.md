# AGENT.md — jooja-quick-auth

This repo is a **client library + CLI** for **Jooja Quick Auth (JQA)**.

JQA is a token vault:
- humans complete OAuth consent once
- refresh tokens stay inside JQA
- agents/tools request **short-lived access tokens** as needed

## Safety / security rules (non-negotiable)

1. **Never commit secrets**
   - Do not commit `.env`.
   - Do not paste real `JQA_SECRET`, `JQA_ADMIN_API_KEY`, OAuth client secrets, bearer tokens, etc. into issues/PRs/logs.

2. **Token handling**
   - This repo DOES provide a CLI command that prints access tokens (`jqa token`). That is the purpose.
   - Still: do not paste tokens into chat logs or long-lived logs.
   - Prefer piping tokens directly into the process that needs them.

3. **Log hygiene**
   - Do not log authorization headers.
   - Avoid logging URLs if they could contain secrets in the future.

4. **No widening the attack surface**
   - Do not add network listeners/servers to this repo.
   - Keep dependencies minimal.

5. **Assume hostile network**
   - Treat all JQA responses as untrusted.
   - Handle non-JSON responses and non-200 codes.

## Operational expectations

- Default base URL must be the public deployment (`https://jooja-auth.leverton.dev`).
  - Only override with `JQA_BASE_URL` / `--base-url` when needed.
- Canonical env vars:
  - `JQA_UUID`, `JQA_SECRET`, `JQA_PROVIDER`

## Developer workflow

```bash
npm install
npm run typecheck
npm run build

# Local smoke test
node dist/cli.js --help
```
