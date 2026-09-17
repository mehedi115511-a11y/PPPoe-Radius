# Task 24 — Role isolation audit (IN_PROGRESS)

Checkpoint: 6d19c81; audited server/index.js, server/schema.sql, src/main.jsx and src/session.jsx.

Findings:
- HIGH: app_clients and app_packages use owner_role rather than owner_user_id. Two unrelated resellers with the same role share visible records and update/delete scope (server/index.js:160,178,322,378,439,477,501; schema.sql:12,57).
- HIGH: syncRadiusUser resolves package speeds by name, not by tenant or selected package ID (server/index.js:237); duplicate names across owners can select an unrelated package.
- MEDIUM: authenticate trusts the role in a signed JWT until expiration without rechecking app_users.status or current role (server/index.js:33-41). A suspended account retains access until token expiry.
- Admin routes use authenticate and requireAdmin, including VPN routes. Impersonation prohibits requireAdmin, but normal role-scoped endpoints inherit role-only access.
- Frontend role preview selector in src/main.jsx is not authorization; API must enforce scope.

Acceptance pending: introduce durable owner_user_id with validated parent hierarchy and migration/backfill; update client/package queries and RADIUS package lookup; add negative cross-tenant tests and suspended-user tests. Requires coordination and migration lock before modifying shared server entrypoint/schema or production DB.

Status: IN_PROGRESS. Static code audit only; no live isolation claim, no production deploy.
