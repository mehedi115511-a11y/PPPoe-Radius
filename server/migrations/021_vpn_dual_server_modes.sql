-- PPPOE-03 dual-server VPN-first workflow. Registry only; no live network mutation.
BEGIN;
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS server_mode varchar(24) NOT NULL DEFAULT 'native';
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS local_address inet NOT NULL DEFAULT inet '10.78.0.1';
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS pool_id bigint REFERENCES app_ip_pools(id);
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS connection_state varchar(24) NOT NULL DEFAULT 'Waiting';
DO $$ BEGIN
 ALTER TABLE vpn_peers ADD CONSTRAINT vpn_peers_server_mode_check CHECK (server_mode IN ('native','central_mikrotik'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
 ALTER TABLE vpn_peers ADD CONSTRAINT vpn_peers_connection_state_check CHECK (connection_state IN ('Waiting','Connected','Disconnected','NeverConnected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS vpn_peers_owner_server_mode_idx ON vpn_peers(owner_user_id,server_mode,status,id);
CREATE UNIQUE INDEX IF NOT EXISTS vpn_peers_owner_tunnel_unique ON vpn_peers(owner_user_id,tunnel_ip) WHERE owner_user_id IS NOT NULL;
COMMIT;
-- Rollback: drop the two indexes, the two constraints, then the four columns.
