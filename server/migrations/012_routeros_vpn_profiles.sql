-- RouterOS-aware portable VPN profiles. No live router changes.
BEGIN;
ALTER TABLE vpn_peers ALTER COLUMN public_key DROP NOT NULL;
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS routeros_major smallint NOT NULL DEFAULT 7 CHECK(routeros_major IN (6,7));
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS protocol varchar(16) NOT NULL DEFAULT 'wireguard'
  CHECK(protocol IN ('wireguard','l2tp_ipsec'));
ALTER TABLE vpn_peers ADD COLUMN IF NOT EXISTS vpn_username varchar(100);
CREATE UNIQUE INDEX IF NOT EXISTS vpn_peers_username_unique
  ON vpn_peers(vpn_username) WHERE vpn_username IS NOT NULL;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='vpn_peers_version_protocol_check') THEN
  ALTER TABLE vpn_peers ADD CONSTRAINT vpn_peers_version_protocol_check CHECK(
   (routeros_major=7 AND protocol='wireguard' AND public_key IS NOT NULL AND vpn_username IS NULL)
   OR (routeros_major=6 AND protocol='l2tp_ipsec' AND public_key IS NULL AND vpn_username IS NOT NULL)
  ) NOT VALID;
 END IF;
END;
$$;
ALTER TABLE vpn_peers VALIDATE CONSTRAINT vpn_peers_version_protocol_check;
COMMIT;
-- Rollback requires removing RouterOS 6 profiles before restoring public_key NOT NULL.
