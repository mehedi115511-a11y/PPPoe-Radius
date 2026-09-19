-- Credential-independent CHR synchronization audit/state foundation. No router changes.
BEGIN;
ALTER TABLE vpn_peers DROP CONSTRAINT IF EXISTS vpn_peers_status_check;
ALTER TABLE vpn_peers ADD CONSTRAINT vpn_peers_status_check
  CHECK(status IN ('Pending','Active','Disabled','Revoked','SyncError'));
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS last_sync_error varchar(64);

CREATE TABLE IF NOT EXISTS vpn_peer_sync_attempts(
 id bigserial PRIMARY KEY,
 peer_id bigint NOT NULL REFERENCES vpn_peers(id),
 actor_user_id bigint NOT NULL REFERENCES app_users(id),
 operation varchar(16) NOT NULL CHECK(operation IN ('Enable','Disable','Revoke','Reconcile')),
 outcome varchar(16) NOT NULL CHECK(outcome IN ('Succeeded','Failed','Mismatch')),
 error_code varchar(64),
 readback jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vpn_peer_sync_attempts_peer_created_idx
 ON vpn_peer_sync_attempts(peer_id,created_at DESC);
GRANT SELECT,INSERT ON vpn_peer_sync_attempts TO pppoe_app;
GRANT USAGE,SELECT ON SEQUENCE vpn_peer_sync_attempts_id_seq TO pppoe_app;
COMMIT;
-- Rollback: preserve/export attempts, then drop table/columns and restore the previous status constraint.
