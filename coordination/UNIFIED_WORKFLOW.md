# Unified PPPoE/RADIUS development workflow

Effective 2026-09-21, the only active remote development branch is `main`.
The former `chat-a/network-vpn`, `chat-b/core-billing`, and `chat-c/integration-release` branches are archived historical references. Do not develop on, merge into, delete, or checkpoint them. They remain only for recovery/audit.

The canonical ordered backlog is `coordination/SECTION_QUEUE.md`: `PPPOE-01` through `PPPOE-17`.

## Execution contract

1. At the beginning of a new section, fetch `origin/main`, verify the authorized nonproduction worktree is clean, and read the selected section definition. Do not repeat the old lane audit.
2. Work only on that section through frontend, API, database, authorization, errors, tests, external adapter and documentation. Use Remote Desktop Commander and the authorized SSH route for continuous implementation.
3. Do not stop after a small subtask and do not ask for `Next` while safe work inside the same section remains. Do not start a different section in parallel.
4. Do not create intermediate GitHub checkpoints. Keep tested section work locally until its entire credential-independent acceptance boundary passes. A safety backup is allowed only for genuine loss risk and must not be presented as completion.
5. At section completion, run targeted tests, isolated PostgreSQL migration twice when applicable, authenticated HTTP/UI tests, full regression and build. Then make one reviewed section commit, push it to `main`, update the section status and add one final evidence comment.
6. If a real router/provider credential or production authorization is required after all safe implementation/tests are complete, report `IMPLEMENTATION_COMPLETE_LIVE_PENDING` with the exact missing verification. Never invent live evidence.
7. Tell the user what menu/page contains the feature and distinguish code on `main` from production deployment. Wait for the user's explicit `Next` before starting the next numbered section.

## Safety

Production path `/opt/pppoe-radius-integration` remains read-only until explicit deployment approval, backup, reviewed mapping, lock, preflight, rollback and smoke plan. Never modify `/opt/project-two`. No force push, hard reset, blind overwrite, secret logging or automatic legacy backfill.
