# AGENT.md — jooja-auth-hub-client

This repo is a **client-side companion** to `jooja-auth-hub`.

It exists mainly so other agents/tools have a single reference implementation for the hub contract.

## Safety / security rules (non-negotiable)

1. **Never commit secrets**
   - Do not commit `.env`.
   - Do not paste real `ADMIN_API_KEY`, OAuth client secrets, bearer tokens, etc. into issues/PRs/logs.
   - Do not commit real `AUTH_HUB_PRINCIPAL_ID` / `AUTH_HUB_CLIENT_SECRET` pairs in tracked files.

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
- Maintain backwards compatibility with the hub v0/v1 legacy contract where feasible, but treat v2 (UUID principal + clientSecret) as the default.
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

- Token retrieval is implemented as an MVP now.
- It is intentionally **limited** (access tokens only; refresh tokens never leave the hub).
- Preferred auth is per-principal `clientSecret` (HTTP Basic).
- Store the credential pair in a local secret file outside git, e.g. `~/.config/jooja-auth-hub-client/env`, unless the target agent already has a canonical secret path.
- Legacy shared bearer-token mode may still exist for transition.
- This client must keep the contract honest: do not add features that widen access or dump secrets.
