# PPPOE-01 Router/NAS delete gate

The backend `deleteRouter` intentionally returns HTTP 409 for any existing router. This is a fail-closed release safeguard, **not** implementation of dependency-aware deletion. Unknown/cross-tenant records return 404, malformed IDs return 422, and role validation still runs. The software and device are not modified by the rejected request.

Reason: no authoritative router ID foreign keys for legacy PPP clients, packages, live sessions, NAS shared secrets and credentials. A router name or address cannot establish dependency absence. UI confirmation alone is insufficient.

To enable deletion: introduce verified tenant-scoped references and reviewed legacy mapping; lock/recheck references in a transaction; return 409 with safe dependency counts for linked records; specify credential and shared-secret retention/revocation and preserve historical data; add real PostgreSQL concurrency/tenant tests and authorized read-only MikroTik verification before any device operation.

Until then do not add a bypass switch or silently delete on a 409. This gate was introduced in commit `50f594db1c9533bbf015c1e77ff053ed3af565e7`, tests updated through `e15140fb8991a485e1406080fccf20053410fd57`. No production deployment or database migration is authorized by this document.
