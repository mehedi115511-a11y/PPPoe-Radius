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
- Scope: wallet ledger plus `server/migrations/010_task44_recharge_receipts.sql`, recharge service/tests, authenticated wallet/ledger/receipt/recharge API wiring and fresh-schema composition.
- Start checkpoint: `307314fadae86d0b5fa9a3a058b2add27a3f9e27`.
- Reason: preserve append-only ledger, idempotency, exact tenant ownership and concurrency guarantees.
- Release condition: isolated migration-twice, immutable-trigger, replay/fingerprint, insufficient-balance concurrency, API authorization, recharge atomicity, full suite/build and integration evidence all pass.

## Deployment lock
None. Production remains unchanged.

## 2026-09-20 integration handoff
- Wallet and reseller work continues in `/opt/pppoe-radius-chat-c`; last verified clean remote-matched feature SHA `dbc0e83b51a918ebae25742bd6b9a434f8d0a8a0`.
- Settlement funding and production backfill/deployment remain gated by exact reconciliation and deployment lock. Zero-balance wallet provisioning creates no money.
- For rollback, revert individual integration commits in reverse order; migration/production rollback needs ledger export and reconciliation first.
