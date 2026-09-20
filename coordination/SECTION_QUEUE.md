# PPPoE/RADIUS section queue and chat handoff

This file is the durable index for ordinary ChatGPT chats. A hashtag such as `#PPPOE-01` is a human-readable identifier, not an automatic ChatGPT conversation link. Read this file and the latest GitHub checkpoints on every new chat/turn. The GitHub repository, rather than a chat transcript, is the source of truth.

Repository: `mehedi115511-a11y/PPPoe-Radius`
Integration branch: `chat-c/integration-release`
Integration worktree: `/opt/pppoe-radius-chat-c`
Production worktree: `/opt/pppoe-radius-integration` (read-only before approved release)
Tracking: Issues #4 (network), #5 (core), #6 (integration).
Remote Desktop Commander device: `NextGan-WiFi`; authorized SSH path is in the project handoff.
Never modify `/opt/project-two`.

## Queue (one section per chat)

| ID | Section | Completion boundary | Current state |
| --- | --- | --- | --- |
| #PPPOE-01 | Routers / NAS | Tenant-owned router catalog and frontend CRUD, safe credential handling, RouterOS connection/health verification, shared secret lifecycle, removal consequences, isolated and live checks | READY |
| #PPPOE-02 | IP Pools | Existing software CRUD plus MikroTik pool import/provision/readback, non-overlap, client assignment, rollback and cleanup | PARTIAL |
| #PPPOE-03 | VPN | RouterOS 6/7 selection and script, CHR peer lifecycle/readback, real connection/handshake, revoke/recovery and UI status | PARTIAL |
| #PPPOE-04 | Packages | Owned CRUD plus router import/profile synchronization, edit/delete propagation, referenced-package behavior | PARTIAL |
| #PPPOE-05 | Clients | Owned CRUD, router/package/pool choice, PPP/RADIUS sync, history, failure handling and UI | PARTIAL |
| #PPPOE-06 | Online Sessions | Real radacct sessions, uptime/IP/usage, client detail, CoA/disconnect, stale session recovery and UI | READY |
| #PPPOE-07 | Expiry | Expiry profile/pool transition and recharge restoration on router/RADIUS, retry/reconcile and UI | READY |
| #PPPOE-08 | Resellers | Account lifecycle, tenant limits, permissions, clients/packages/wallet relationships and UI | PARTIAL |
| #PPPOE-09 | Sub-resellers | Parent ownership, lifecycle, limits, permissions, settlement and UI | PARTIAL |
| #PPPOE-10 | Wallet & Funding | Secure externally verified payment settlement, balanced append-only ledger, reversal, admin review/reconciliation and UI | PARTIAL |
| #PPPOE-11 | Recharge & Billing | Full cycle/custom days plus invoice, due/partial payments, discounts, collections, receipts, profit and UI | PARTIAL |
| #PPPOE-12 | Dashboard & Reports | Replace demo/static numbers, dates and graphs with reconciled live data, functional filters and reports | PARTIAL |
| #PPPOE-13 | Customer Portal | Customer identity, package, expiry, usage, invoices, payment view and access controls | READY |
| #PPPOE-14 | Notifications | Expiry, due and recharge messages, selected provider adapter, retries and delivery status | READY |
| #PPPOE-15 | Settings & Security | Permission matrix, profile/password controls, audit, rate limits, secret rotation and UI | PARTIAL |
| #PPPOE-16 | Portable Installer & Operations | Transferable archive, database/admin setup, supported hosting, TLS, service/health, backup and restore rehearsal | PARTIAL |
| #PPPOE-17 | Final Integration & Production | Cross-section end-to-end and load tests, exact legacy mapping, reviewed backup/migration, approved deployment, smoke and rollback | WAITING_APPROVAL |

`PARTIAL` means some code or tests exist, never that the full section has shipped.
Do not automatically advance to the next ID when a section is PARTIAL or WAITING_EXTERNAL.

## Single-section work protocol

1. On a new ordinary chat, identify the ID, read this file, current issue comments and the integration branch. Fetch and verify a clean worktree and matching remote SHA; do not reset or overwrite user changes.
2. Work only on the selected section. Plan its UI, API, schema, roles, safety, router/provider behavior, errors, observability and rollback together. Implement all safe work until that section is reviewable.
3. Verify meaningful frontend interactions, isolated PostgreSQL migration twice if changed, authenticated HTTP tests, full tests and build. Add mocked external-device tests; run live checks only with configured credentials and authorized change scope. Record commands, exit codes and counts.
4. Commit and push each tested logical change without force push. Update the relevant issue with exact SHA, changed files, tests, rollback and gaps. Refresh the portable archive after committed changes.
5. Report `COMPLETE` only when the defined end-to-end boundary has evidence, including real-device/provider verification where required. If external credentials or production approval are missing, report `WAITING_EXTERNAL` for the same ID, identify exactly what is missing, and keep the next ID untouched.
6. Tell the user the precise dashboard menu/page and what they can click. Distinguish code on the integration branch from a live production deployment. Do not claim the user can see an undeployed feature on the production URL.
7. Pause after the section report. Move to the next queue item only after the user's explicit `Next` instruction.

## Tool access fallback for ordinary chats

A Remote Desktop Commander rejection of a file creation or transfer command is a tool safety decision about that exact command. It does **not** prove that SSH is read-only, that the VPS worktree is unwritable, or that section #PPPOE-01 is externally blocked. Do not retry the rejected command unchanged or ask the user to paste base64/shell commands.

1. Prefer the GitHub connector `fetch_file` / `create_file` / `update_file` for ordinary UTF-8 source edits on `chat-c/integration-release`; pass the current blob SHA when replacing a file. Make one reviewed logical change at a time. GitHub contents writes create a commit and return its SHA; avoid untested multi-file commits when a test route is available.
2. Verify the remote SHA and, if the VPS integration worktree is clean, bring it forward with `git fetch origin` and `git pull --ff-only origin chat-c/integration-release`. Never hard-reset or force-push. Run syntax checks, isolated DB/API tests, the full suite and build through the available authorized VPS execution route. GitHub writes are no substitute for test evidence.
3. If remote execution is blocked too, check whether a connected CI runner can execute the existing tests. Without a test route, report the exact blocked action and leave the section `IN_PROGRESS / UNVERIFIED`; do not call it COMPLETE or imply VPS changes were applied.
4. Only if both GitHub editing and authorized nonproduction execution are genuinely unavailable, report `WAITING_TOOL_ACCESS` with the specific tool rejection and the smallest required connection. If router credentials are missing, continue code, UI and mock tests within the same section; reserve `WAITING_EXTERNAL` for the real-device verification boundary.
5. Never use the production worktree or `/opt/project-two` as a workaround. Do not put credentials in GitHub contents, commands, logs, tests or issue comments.

## Production guard

No production migration, deploy, service restart, CHR/router configuration change or legacy ownership backfill without explicit approval, backup, reviewed exact mapping, deployment lock, preflight, rollback and smoke plan. The worktree `/opt/pppoe-radius-integration` stays read-only until then. A working ZIP requires Node.js/PostgreSQL-compatible hosting; PHP-only shared hosting is not established.

## Ordinary chat starter

```text
#PPPOE-01
I am working only on section #PPPOE-01 (Routers / NAS) of mehedi115511-a11y/PPPoe-Radius.
Read coordination/SECTION_QUEUE.md on chat-c/integration-release and latest GitHub Issues #4, #5 and #6. Verify the current integration SHA/worktree before editing; do not restart old audits.
Implement the complete section including frontend, API, database, roles, tests and RouterOS integration as far as credentials and approval permit. Commit/push tested changes and log evidence in the issue. Keep production read-only. Do not move to #PPPOE-02 until I explicitly say Next.
When you stop, report COMPLETE or WAITING_EXTERNAL accurately, give exact SHA/tests, and tell me where to see the feature. If a Remote Desktop Commander file-transfer command is rejected, read the Tool access fallback section: edit text with the GitHub connector, then safely fast-forward a clean integration worktree and run tests through authorized execution. Do not label the entire section WAITING_EXTERNAL after one rejected command. If both edit and test routes truly fail, report the exact missing access without inventing progress.
```

In the same chat, send `#PPPOE-01 continue` for follow-ups. A fresh chat must repeat the starter or at minimum include the ID, repository and this file URL: hashtags alone do not transfer context. After the section is COMPLETE and the user says Next, use `#PPPOE-02` with the same protocol.
