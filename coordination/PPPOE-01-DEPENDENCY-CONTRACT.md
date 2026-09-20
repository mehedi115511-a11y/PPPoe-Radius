# PPPOE-01 router removal dependency contract

Status: unresolved release gate; this document does not enable deletion of provisioned devices.

The current `app_routers` catalog is software-only. Existing `app_clients` and `app_packages` tenant tables do not define an authoritative `app_routers.id` foreign key in migration 006. The portable `radcheck` and `radreply` tables in migration 013 identify users by username and likewise do not provide a router FK. Therefore an inferred name/host match is **not** evidence that deleting an NAS is safe.

Before enabling deletion of a router referenced by live PPP clients, packages, RADIUS NAS records, active sessions, or connection credentials:

1. Introduce and migrate explicit tenant-scoped router references and inspect legacy mapping without guessed ownership or automatic backfill.
2. Reject deletion with HTTP 409 and a non-sensitive dependency summary when any referencing active records exist; do not delete or alter MikroTik configuration as a side effect.
3. Define cleanup of encrypted API credentials and RADIUS shared secrets with retention/audit/revocation, transaction boundaries, retries and rollback.
4. Prove owner-scope, concurrency, duplicate endpoint, deleted-router references, and retained history in isolated PostgreSQL tests. Then perform authorized device read-only health verification.
5. Do not run migration or deploy to production without approved lock, backup, reviewed mapping and rollback.

Current deletion is only a soft delete in `server/routers/catalog.js`, without these dependency checks. Treat it as **not release-ready**; UI confirmation alone is insufficient. Do not claim PPPOE-01 COMPLETE until this contract has executable enforcement and required real-device evidence.
