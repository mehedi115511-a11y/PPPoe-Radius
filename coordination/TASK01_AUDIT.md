# Task 01 — VPN/network audit (2026-09-18)

Source HEAD at audit: 6d19c81; master clean; isolated worktree work/chat-a-network.
Verified: pppoe-api, freeradius, postgresql active; pppoe-radius-chr VM running; default and radius-private libvirt networks active.
VPN source: server/vpn-address.js, server/vpn-config.js; migration 005_vpn_peers.sql; protected peer list/create/manual script/pending-only revoke API in server/index.js.
Database vpn_peers table exists and currently has zero rows. Migration has unique name/public key/tunnel IP, allowed statuses, tunnel subnet constraint, application grants and audit table.
Tests: npm test -- --run server/vpn-address.test.js server/vpn-config.test.js => 2 files, 6 tests passed. node --test is incorrect for Vitest tests and fails because of runner mismatch.
Gaps: CHR live WireGuard interface/peer/read-back not yet authenticated or inspected; sync is explicitly manual-only, peer remains Pending; no real handshake, monitoring or remote hardware acceptance. Frontend VPN screen not identified by initial src scan.
Service state and VM running do not prove PPP/RADIUS/VPN end-to-end connectivity. No production network or database changes performed.
Task 01 remaining acceptance: read-only CHR WireGuard state verification and coordination publication. Task 02 should verify CHR SSH/API credential access without exposing secrets.
