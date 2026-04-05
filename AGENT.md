# AGENT.md — jooja-auth-hub-client

This repo is a **client-side companion** to `jooja-auth-hub`.

It exists mainly so other agents/tools have a single reference implementation for the hub contract.

## Safety / security rules (non-negotiable)

1. **Never commit secrets**
   - Do not commit `.env`.
   - Do not paste real `ADMIN_API_KEY`, OAuth client secrets, bearer tokens, etc. into issues/PRs/logs.

2. **Do not exfiltrate tokens**
   - The hub is a token vault.
   - This client MUST NOT add “quick hacks” that dump token contents to stdout.

3. **Log hygiene**
   - Do not log full URLs if they could contain secrets in the future.
   - Prefer structured logs with redaction.

4. **No widening the attack surface**
   - Do not add network listeners/servers to this repo.
   - Keep this repo a library/CLI only.

5. **Assume hostile network**
   - Treat all hub responses as untrusted.
   - Handle non-JSON responses and non-200 codes.

## Operational expectations

- Keep dependencies minimal.
- Maintain backwards compatibility with the hub v0 contract.
- When hub endpoints change, update:
  - `docs/contract.md`
  - `README.md`
  - CLI command behavior/messages

## Developer workflow

```bash
npm install
npm run typecheck
npm run build

# Local smoke test (assuming the hub is running)
node dist/cli.js health
```

## Notes

- Token retrieval is intentionally only a placeholder right now.
- When the hub adds a real retrieval endpoint, implement it here **only** if:
  - the endpoint requires strong auth (client secret / mTLS / short-lived signed requests)
  - the retrieval flow includes least-privilege + auditability
