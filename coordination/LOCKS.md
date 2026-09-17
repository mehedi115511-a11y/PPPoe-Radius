# Coordination Locks

A lock must include owner, scope, start checkpoint, reason, and release condition.

## Rules
- No simultaneous edit of the same shared file.
- No production migration or deployment without a deployment lock.
- Feature chats do not merge their own work into the release branch.
- Chat C owns controlled integration, smoke tests, rollback evidence, and lock release.
- A chat blocked on a shared file must continue independent work instead of editing around the lock.

## Active locks
### Task 24 shared schema
- Owner: Chat B
- Scope: `server/schema.sql` and any new Task-24 migration file that changes shared client/package/accounting/billing or tenant-ownership columns.
- Start checkpoint: Chat B `4c6833c78fd361408090a8c7a803c71ad96a2552`
- Reason: prevent Task 24 and Task 44 from creating conflicting ownership/schema migrations.
- Chat C rule: do not edit the locked scope; continue independent wallet/service/security tests and document required contract changes.
- Release condition: Chat B pushes the schema commit, updates Issue #5 with migration/test evidence, and marks Task 24 `READY_FOR_REVIEW`; Chat C then reviews and integrates.
