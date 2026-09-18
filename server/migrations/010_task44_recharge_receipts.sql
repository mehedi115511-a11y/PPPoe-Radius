-- Task 44: atomic wallet-backed recharge receipts. Production execution is release-gated.
BEGIN;
CREATE TABLE IF NOT EXISTS app_recharge_receipts (
  id bigserial PRIMARY KEY,
  receipt_reference text NOT NULL UNIQUE,
  tenant_owner_user_id bigint NOT NULL REFERENCES app_users(id),
  client_id bigint NOT NULL REFERENCES app_clients(id),
  package_id bigint NOT NULL REFERENCES app_packages(id),
  actor_user_id bigint NOT NULL REFERENCES app_users(id),
  recharge_mode text NOT NULL CHECK (recharge_mode IN ('full_cycle','custom_days')),
  selected_days integer CHECK ((recharge_mode='full_cycle' AND selected_days IS NULL) OR (recharge_mode='custom_days' AND selected_days > 0)),
  recharge_date date NOT NULL,
  calculated_amount_minor bigint NOT NULL CHECK(calculated_amount_minor >= 0),
  previous_expiry date NOT NULL,
  new_expiry date NOT NULL,
  wallet_ledger_transaction_id bigint NOT NULL UNIQUE REFERENCES wallet_ledger_transactions(id),
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$'),
  request_fingerprint text NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_owner_user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS app_recharge_receipts_tenant_created_idx ON app_recharge_receipts(tenant_owner_user_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS app_recharge_receipts_client_idx ON app_recharge_receipts(client_id,created_at DESC);
CREATE OR REPLACE FUNCTION prevent_recharge_receipt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'recharge receipts are immutable'; END;
$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='recharge_receipts_immutable') THEN
    CREATE TRIGGER recharge_receipts_immutable BEFORE UPDATE OR DELETE ON app_recharge_receipts
      FOR EACH ROW EXECUTE FUNCTION prevent_recharge_receipt_mutation();
  END IF;
END;
$$;
GRANT SELECT,INSERT ON app_recharge_receipts TO pppoe_app;
GRANT USAGE,SELECT ON SEQUENCE app_recharge_receipts_id_seq TO pppoe_app;
COMMIT;
-- Rollback is release-gated: export/reconcile receipts before DROP TABLE app_recharge_receipts.
