-- PPPOE-03: tenant-owned, router-bound and idempotent VPN profiles.
-- Additive only; no RouterOS/CHR mutation.
BEGIN;

ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS owner_user_id bigint REFERENCES app_users(id);
-- Legacy owner remains NULL until separately reviewed and explicitly authorized.
-- Application writes must supply a verified owner; NULL-owned rows stay inaccessible.

ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS router_id bigint REFERENCES app_routers(id);
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS idempotency_key varchar(128);
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS request_fingerprint char(64);
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS last_readback jsonb;
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS last_handshake_at timestamptz;

ALTER TABLE vpn_peers DROP CONSTRAINT IF EXISTS vpn_peers_name_key;
DROP INDEX IF EXISTS vpn_peers_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS vpn_peers_owner_name_unique
  ON vpn_peers(owner_user_id,name);
CREATE UNIQUE INDEX IF NOT EXISTS vpn_peers_owner_idempotency_unique
  ON vpn_peers(owner_user_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS vpn_peers_owner_status_idx
  ON vpn_peers(owner_user_id,status,id);
CREATE INDEX IF NOT EXISTS vpn_peers_router_idx
  ON vpn_peers(router_id) WHERE router_id IS NOT NULL;

ALTER TABLE vpn_peer_audit ADD COLUMN IF NOT EXISTS owner_user_id bigint REFERENCES app_users(id);
-- Preserve historical audit ownership unchanged; do not infer tenant ownership.
ALTER TABLE vpn_peer_audit DROP CONSTRAINT IF EXISTS vpn_peer_audit_action_check;
ALTER TABLE vpn_peer_audit ADD CONSTRAINT vpn_peer_audit_action_check
  CHECK(action IN ('Created','Enabled','Disabled','Revoked','Reconciled','RetryRequested'));
CREATE INDEX IF NOT EXISTS vpn_peer_audit_owner_created_idx
  ON vpn_peer_audit(owner_user_id,created_at DESC);

ALTER TABLE vpn_peer_sync_attempts ADD COLUMN IF NOT EXISTS owner_user_id bigint REFERENCES app_users(id);
-- Preserve historical sync ownership unchanged; do not infer tenant ownership.
CREATE INDEX IF NOT EXISTS vpn_peer_sync_owner_created_idx
  ON vpn_peer_sync_attempts(owner_user_id,created_at DESC);

CREATE OR REPLACE FUNCTION reject_vpn_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'VPN audit rows are immutable'; END $$;
DROP TRIGGER IF EXISTS vpn_peer_audit_immutable ON vpn_peer_audit;
CREATE TRIGGER vpn_peer_audit_immutable BEFORE UPDATE OR DELETE ON vpn_peer_audit
FOR EACH ROW EXECUTE FUNCTION reject_vpn_audit_mutation();
DROP TRIGGER IF EXISTS vpn_peer_sync_attempts_immutable ON vpn_peer_sync_attempts;
CREATE TRIGGER vpn_peer_sync_attempts_immutable BEFORE UPDATE OR DELETE ON vpn_peer_sync_attempts
FOR EACH ROW EXECUTE FUNCTION reject_vpn_audit_mutation();

COMMIT;
-- Rollback: drop the new indexes/triggers/columns only after exporting audit evidence.
