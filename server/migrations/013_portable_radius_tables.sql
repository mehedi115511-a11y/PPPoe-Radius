-- Portable FreeRADIUS credential tables. Existing external RADIUS tables are preserved.
BEGIN;
CREATE TABLE IF NOT EXISTS radcheck (
  id bigserial PRIMARY KEY,
  username varchar(64) NOT NULL DEFAULT '',
  attribute varchar(64) NOT NULL DEFAULT '',
  op varchar(2) NOT NULL DEFAULT ':=',
  value varchar(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radcheck_username_idx ON radcheck(username,attribute);
CREATE TABLE IF NOT EXISTS radreply (
  id bigserial PRIMARY KEY,
  username varchar(64) NOT NULL DEFAULT '',
  attribute varchar(64) NOT NULL DEFAULT '',
  op varchar(2) NOT NULL DEFAULT '=',
  value varchar(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radreply_username_idx ON radreply(username,attribute);
GRANT SELECT,INSERT,UPDATE,DELETE ON radcheck,radreply TO pppoe_app;
GRANT USAGE,SELECT ON SEQUENCE radcheck_id_seq,radreply_id_seq TO pppoe_app;
COMMIT;
-- Rollback: retain credential rows until backed up/reconciled; drop only tables created by this migration.
