# PPPoE/RADIUS Master Continuation File

Use this file when a Work chat limit ends and development must continue in a new ordinary ChatGPT chat. The Git repository is authoritative; never infer completion from an old chat transcript.

## Project access

- Repository: `mehedi115511-a11y/PPPoe-Radius`
- Active remote branch: `main` only
- Development worktree: `/opt/pppoe-radius-chat-c`
- Production worktree: `/opt/pppoe-radius-integration` (read-only until an approved release)
- Remote Desktop Commander device: `NextGan-WiFi`
- SSH: `ssh -i /root/.ssh/pppoe_radius_vps_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes root@149.104.71.83`
- Never modify `/opt/project-two`.
- Tracking Issues: #4 network, #5 core, #6 integration.

## Mandatory continuation procedure

1. Read `coordination/UNIFIED_WORKFLOW.md`, `coordination/SECTION_QUEUE.md`, this file, and the latest comments on Issues #4, #5 and #6.
2. In `/opt/pppoe-radius-chat-c`, run `git fetch origin`, `git status --short --branch`, `git rev-parse HEAD`, and `git rev-parse origin/main`.
3. Require a clean worktree and matching SHA. If behind, use only a safe reviewed `git pull --ff-only`; never hard reset, force-push, blind overwrite, or discard user changes.
4. Work on exactly one numbered section until all safe implementation, frontend, API, schema, negative tests, isolated PostgreSQL checks and build are complete.
5. Do not make intermediate GitHub checkpoints. At the complete section boundary, create one reviewed commit, push `main`, update the relevant Issue once, refresh the portable package, and report exact evidence.
6. If live credentials or production approval are absent, finish code/UI/mock/isolated tests and report `IMPLEMENTATION_COMPLETE_LIVE_PENDING`; do not call the whole project blocked and do not start the next section without the user's instruction.

## Completed section evidence

- `#PPPOE-01 Routers / NAS`: implementation complete; live-router verification pending configured credentials. Frontend location: `Services → Routers / NAS`.
- `#PPPOE-02 IP Pools`: implementation complete; live RouterOS verification pending configured credentials. Frontend location: `Services → IP Pools`.
- PPPOE-02 includes tenant CRUD, CIDR overlap protection, RouterOS 6/7 API-SSL transport, router selection, remote list/import, provision/update, exact readback, drift state, client assignment, safe removal with compensation, append-only audit, tenant/cross-tenant guards, isolated migration and UI.
- Obtain the exact authoritative SHA with `git rev-parse origin/main`; confirm it matches local HEAD before editing.

## Next chapter

The next section is `#PPPOE-03 — VPN`. Its completion boundary is: dedicated VPN UI, manual RouterOS 6/7 selection, one-time ready-to-paste script, CHR peer enable/disable/revoke, readback/handshake, retry/recovery, audit and mocked plus authorized live verification. Reuse the existing partial VPN implementation; do not restart completed audits.

## New ordinary Chat starter prompt

```text
#PPPOE-03
Continue the PPPoE/RADIUS project `mehedi115511-a11y/PPPoe-Radius` using `coordination/MASTER_CONTINUATION.md` as the master handoff and GitHub `main` as the only source of truth.

First read `coordination/UNIFIED_WORKFLOW.md`, `coordination/SECTION_QUEUE.md`, the master file, and latest Issues #4, #5 and #6. Through Remote Desktop Commander device `NextGan-WiFi`, verify `/opt/pppoe-radius-chat-c` is clean and local HEAD equals `origin/main`; use only safe ff-only advancement if needed. Never modify `/opt/project-two` and keep `/opt/pppoe-radius-integration` read-only.

Work only on #PPPOE-03 VPN and continue until every safe part of that section is complete: frontend, authenticated tenant/admin APIs, schema/audit, manual RouterOS 6/7 selection, automatically generated paste-ready MikroTik script, CHR peer lifecycle, readback/handshake status, retries, compensation/reconciliation, security, mocked RouterOS tests, full tests, isolated PostgreSQL checks and build. Use existing partial code; do not redo old audits. Never print or commit secrets, and do not mutate production/CHR without explicit approval and configured credentials.

Do not create intermediate GitHub checkpoints. At the complete section boundary, make one reviewed commit, push main, update the correct Issue once with exact SHA/files/tests/rollback/gaps, refresh the portable package, update this master file for #PPPOE-04, and report COMPLETE or IMPLEMENTATION_COMPLETE_LIVE_PENDING accurately. Do not begin #PPPOE-04 until I explicitly say Next.
```

## Production guard

No production migration, deployment, service restart, RouterOS/CHR mutation, or legacy owner backfill without explicit approval, backup, deployment lock, reviewed mapping, preflight, rollback and smoke plan. Never expose credentials, `.env` values, tokens, keys, database passwords or stored encrypted values.
