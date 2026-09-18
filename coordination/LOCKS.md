# Coordination Locks

## Rules
- One unified engineer works sequentially in one worktree at a time.
- No production migration or deployment without an explicit deployment lock.
- No force-push, hard reset, blind overwrite, secret disclosure, or unverified merge.
- A credential-dependent check never blocks independent implementation or tests.

## Released locks
### Task 24 shared schema
- Former owner: Chat B / core lane.
- Released after migration-twice, fresh-schema, authenticated cross-tenant API tests, suspended-token revalidation, full tests/build, and controlled merge into `chat-c/integration-release`.
- Integration merge checkpoint: `d29f6c62259d505885eb9f4bcbddc7248a3fda3c`.
- Production migration remains separately locked and was not performed.

## Active locks
### Task 44 wallet schema/service
- Owner: unified engineer on `chat-c/integration-release`.
- Scope: `server/migrations/009_task44_wallet_ledger.sql`, `server/wallet/ledger.js`, `server/wallet/wallet-store.js`, their tests and future wallet API wiring.
- Start checkpoint: `307314fadae86d0b5fa9a3a058b2add27a3f9e27`.
- Reason: preserve append-only ledger, idempotency, exact tenant ownership and concurrency guarantees.
- Release condition: isolated migration-twice, immutable-trigger, replay/fingerprint, insufficient-balance concurrency, API authorization, recharge atomicity, full suite/build and integration evidence all pass.

## Deployment lock
None. Production remains unchanged.
