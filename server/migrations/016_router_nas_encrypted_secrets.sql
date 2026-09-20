-- PPPOE-01: ciphertext-only router credentials; never write plaintext secrets.
-- This migration is additive. No production deployment is authorized by this file.
BEGIN;
CREATE TABLE IF NOT EXISTS app_router_secrets (
  router_id bigint NOT NULL REFERENCES app_routers(id) ON DELETE RESTRICT,
  owner_user_id bigint NOT NULL REFERENCES app_users(id),
  purpose varchar(32) NOT NULL CHECK (purpose IN ('router-api','radius-shared-secret')),
  encrypted_value text NOT NULL CHECK (encrypted_value LIKE 'v1:%'),
  key_version integer NOT NULL DEFAULT 1 CHECK (key_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (router_id, purpose)
);
CREATE INDEX IF NOT EXISTS app_router_secrets_owner_idx ON app_router_secrets(owner_user_id, router_id);
-- Backfill and key material deliberately excluded. Access only through tenant-scoped server API.
COMMIT;
