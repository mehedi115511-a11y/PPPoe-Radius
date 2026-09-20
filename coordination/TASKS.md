# Central Task Board

GitHub is the source of truth. The former Chat A, B, and C lanes are now managed sequentially by one unified engineer while their branches and history remain preserved.

## Historical branch scopes
- `chat-a/network-vpn` — Tasks 01–23: Network, VPN, MikroTik, NAS/router services.
- `chat-b/core-billing` — Tasks 24–43: Client, package, sessions, accounting, recharge, expiry, billing.
- `chat-c/integration-release` — Tasks 44–65 plus controlled integration and release.

## Bootstrap ancestry checkpoints
These are known-good baseline ancestors, not exact current HEAD values. Validate ancestry; a newer HEAD is not a blocker.
- main baseline: a4c749f359d60a2eafea757316486f87f03c973e
- Network baseline: aad1cc61c4e0c9a95b22b97fd5d191a6f528335a
- Core baseline: 4c6833c78fd361408090a8c7a803c71ad96a2552
- Integration baseline: a4c749f359d60a2eafea757316486f87f03c973e

## Current verified status
- GitHub history import: COMPLETE.
- Network lane: IN_PROGRESS; latest mocked CHR suite previously passed 27/27, live authenticated RouterOS integration remains.
- Task 24 tenant security: VERIFIED in isolated DB/API tests and merged into integration branch at d29f6c62259d505885eb9f4bcbddc7248a3fda3c.
- Task 24 production reconciliation: WAITING_APPROVAL; exact legacy mapping, backup, deployment lock and rollback are required before production migration.
- Task 44 wallet/recharge API: READY_FOR_REVIEW on integration branch. Authenticated own-wallet/ledger/receipt endpoints, migration 010, full-cycle and integer half-up custom-day recharge, atomic wallet+expiry+receipt posting, immutable receipts and concurrency-safe replay are implemented.
- Latest evidence: fresh schema twice, RECHARGE_INTEGRATION_PASS (replay, identical/different concurrency, rollback, balanced ledger, immutable rows, tenant/suspended/impersonated/NULL-owner denial), 37/37 Vitest, 9/9 files and build passed. Production unchanged.
- Production: UNCHANGED. No production deploy or migration is authorized.

## Target VPS route
Use Remote Desktop Commander device `NextGan-WiFi`, then:
`ssh -i /root/.ssh/pppoe_radius_vps_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes root@149.104.71.83`

Worktrees:
- Network: `/opt/pppoe-radius-chat-a`
- Core: `/opt/pppoe-radius-chat-b`
- Integration: `/opt/pppoe-radius-chat-c`
- Production: `/opt/pppoe-radius-integration` (read-only until explicit deployment approval)

Status flow: TODO → IN_PROGRESS → WAITING_DEPENDENCY/BLOCKED → READY_FOR_REVIEW → VERIFIED → MERGED → DEPLOYED.

## 2026-09-20 integration continuation
- Verified clean local and origin integration HEAD `dbc0e83b51a918ebae25742bd6b9a434f8d0a8a0` before this coordination update.
- Recharge quote guards stale UI selection and rejects changed charge; isolated PostgreSQL recharge evidence `RECHARGE_INTEGRATION_PASS`.
- Fresh installer creates an empty admin wallet and writes its ID as `BILLING_WALLET_OWNER_USER_ID`; rerun validates administrator identity.
- Bootstrap and admin reseller creation provision zero-balance tenant/settlement wallets. Reseller-only child creation and tenant-scoped listing are implemented; the Resellers UI exposes both forms by role.
- Isolated PostgreSQL: `INSTALL_WALLET_PASS`, `BOOTSTRAP_WALLETS_PASS`, `RESELLER_API_PASS`, `INSTALL_SETTLEMENT_PASS`, `SUBRESELLER_API_PASS`. Latest Vitest: 86/86 in 20 files; build exit 0. Portable archives rebuilt from committed source.
- Next: controlled funding/reconciliation and end-to-end configuration of recharge; live CHR credentials and production deployment remain separately approval-dependent. No production data or services changed.

## 2026-09-20 later checkpoint
- Feature HEAD `3271fe94958b79901bf7f3ae33f7a0e067497aef`: read-only CHR interface-scoped peer and handshake reporting, receipt-to-ledger reconciliation with tenant-scoped access, and same-wallet settlement denial regression evidence.
- Latest isolated recharge integration: balanced receipt, extra-entry mismatch and cross-tenant denial, in addition to replay, concurrency, rollback and immutability. Full Vitest 88/88, build exit 0. Portable ZIP extracted and fresh installer validated earlier at `a3c1cdbf41f51066f18d2c5e90198854902f791c`; subsequent archives rebuilt from latest commits.
- CHR REST credentials absent in integration and production .env paths; live handshake is untested. Funding policy and separate admin settlement remain to implement. Production unchanged.

## 2026-09-20 admin settlement continuation
- Feature SHA `b2655b92f6712d88ad88cc84450116e655d07773`: fresh installs create separate zero-balance admin settlement account behind a suspended internal identity and write its ID to fresh .env. Admin recharge uses that owner; reseller recharge keeps global admin settlement owner.
- Isolated PostgreSQL `ADMIN_SETTLEMENT_PASS wallets=2 initial=0 rerun=1 recharge=50000 balanced=1`; test-only funds were injected only in the isolated database. Latest extracted ZIP `PORTABLE_ADMIN_PASS migrations=9 clients=0 packages=0 wallets=2 internal_suspended=1` and build exit 0. Full Vitest 88/88 and build exit 0 before packaging.
- Existing installations are not backfilled. External payment-backed wallet funding remains to design and implement; no production funds or data changed.


## 2026-09-20 funding evidence HTTP checkpoint
- Prior integration HEAD `4f06b7fdbba06dd72a7027c3707d543cbee691ff`: immutable tenant-scoped payment evidence and admin review. Review does not credit a wallet; verified provider settlement remains pending.
- Temporary isolated PostgreSQL database with ten migrations: authenticated HTTP create 201, exact replay 200, changed request 409, malformed amount 422, cross-tenant reference claim 409, tenant listing isolation, reseller admin denial 403, impersonated financial write denial 403 and suspended token denial 401. Wallet balance and ledger entries remained zero.
- Concurrent identical HTTP submissions returned exactly one 201 and one 200 referencing the same request; persisted count was one. No production migration, funding or router mutation.
- Portable ZIP/TAR generated from committed source. Next safe work: externally verifiable funding settlement integration or credential-independent network and installer tests; live CHR requires configured access and production deployment requires separate approval.
