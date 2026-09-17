# Central Task Board

GitHub is the source of truth for Chat A, Chat B, and Chat C.

## Ownership
- Chat A — Tasks 01–23: Network, VPN, MikroTik, NAS/router services.
- Chat B — Tasks 24–43: Client, package, sessions, accounting, recharge, expiry, billing.
- Chat C — Tasks 44–65: Wallet, portal, security, QA, integration, release.

## Bootstrap ancestry checkpoints
These are known-good baseline ancestors, not exact current HEAD values. Coordination-only commits will make HEAD differ. Validate with `git merge-base --is-ancestor <checkpoint> HEAD`; do not report a blocker merely because `HEAD` is newer.
- main baseline: a4c749f359d60a2eafea757316486f87f03c973e
- Chat A baseline: aad1cc61c4e0c9a95b22b97fd5d191a6f528335a
- Chat B baseline: 4c6833c78fd361408090a8c7a803c71ad96a2552
- Chat C baseline: a4c749f359d60a2eafea757316486f87f03c973e

## Current status
- GitHub history import: COMPLETE
- Task 24: IN_PROGRESS — Chat B owns the shared client/package/accounting/billing schema contract.
- Task 44: IN_PROGRESS — Chat C may continue wallet/service/security audit and tests that do not change the locked shared schema.
- Task 44 shared-schema portion: WAITING_DEPENDENCY until Chat B publishes its schema commit and marks Task 24 READY_FOR_REVIEW.
- Production: UNCHANGED. No feature chat may deploy.

## Target VPS route
Use Remote Desktop Commander device `NextGan-WiFi`, then:
`ssh -i /root/.ssh/pppoe_radius_vps_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes root@149.104.71.83`

Worktrees:
- Chat A: `/opt/pppoe-radius-chat-a`
- Chat B: `/opt/pppoe-radius-chat-b`
- Chat C: `/opt/pppoe-radius-chat-c`
- Production: `/opt/pppoe-radius-integration` (read-only unless deployment is explicitly approved)

Status flow: TODO → IN_PROGRESS → WAITING_DEPENDENCY/BLOCKED → READY_FOR_REVIEW → VERIFIED → MERGED → DEPLOYED.
