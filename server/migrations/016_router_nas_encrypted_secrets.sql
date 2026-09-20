-- PPPOE-01: ciphertext-only router credentials; no plaintext, keys, or backfill.
-- Additive integration schema; production migration requires separate approval.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS app_routers_id_owner_unique ON app_routers(id, owner_user_id);
CREATE TABLE IF NOT EXISTS app_router_secrets (
  router_id bigint NOT NULL,
  owner_user_id bigint NOT NULL,
  purpose varchar(32) NOT NULL CHECK (purpose IN ('router-api','radius-shared-secret')),
  encrypted_value text NOT NULL CHECK (encrypted_value LIKE 'v1:%'),
  key_version integer NOT NULL DEFAULT 1 CHECK (key_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (router_id, purpose),
  CONSTRAINT app_router_secrets_router_owner_fk FOREIGN KEY (router_id, owner_user_id)
    REFERENCES app_routers(id, owner_user_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS app_router_secrets_owner_idx ON app_router_secrets(owner_user_id, router_id);
-- Grant only to the scoped application role after privileges and key custody are reviewed.
COMMIT;
