-- Task 44: durable tenant-scoped wallet and immutable double-entry ledger.
-- Apply only after Task 24 ownership reconciliation and deployment approval.
BEGIN;

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id bigserial PRIMARY KEY,
  tenant_owner_user_id bigint NOT NULL REFERENCES app_users(id),
  owner_user_id bigint NOT NULL REFERENCES app_users(id),
  currency char(3) NOT NULL DEFAULT 'BDT' CHECK (currency = 'BDT'),
  balance_minor bigint NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_owner_user_id, owner_user_id, currency)
);
CREATE INDEX IF NOT EXISTS wallet_accounts_tenant_idx
  ON wallet_accounts(tenant_owner_user_id, id);

CREATE TABLE IF NOT EXISTS wallet_ledger_transactions (
  id bigserial PRIMARY KEY,
  tenant_owner_user_id bigint NOT NULL REFERENCES app_users(id),
  operation text NOT NULL CHECK (operation ~ '^[a-z][a-z0-9:_-]{0,63}$'),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  source_reference text,
  actor_user_id bigint NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_owner_user_id, operation, idempotency_key)
);
CREATE INDEX IF NOT EXISTS wallet_ledger_transactions_tenant_created_idx
  ON wallet_ledger_transactions(tenant_owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
  id bigserial PRIMARY KEY,
  transaction_id bigint NOT NULL REFERENCES wallet_ledger_transactions(id),
  wallet_account_id bigint NOT NULL REFERENCES wallet_accounts(id),
  direction text NOT NULL CHECK (direction IN ('debit','credit')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, wallet_account_id, direction)
);
CREATE INDEX IF NOT EXISTS wallet_ledger_entries_account_idx
  ON wallet_ledger_entries(wallet_account_id, id);

CREATE OR REPLACE FUNCTION prevent_wallet_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'wallet ledger rows are append-only';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wallet_transactions_immutable') THEN
    CREATE TRIGGER wallet_transactions_immutable
      BEFORE UPDATE OR DELETE ON wallet_ledger_transactions
      FOR EACH ROW EXECUTE FUNCTION prevent_wallet_ledger_mutation();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'wallet_entries_immutable') THEN
    CREATE TRIGGER wallet_entries_immutable
      BEFORE UPDATE OR DELETE ON wallet_ledger_entries
      FOR EACH ROW EXECUTE FUNCTION prevent_wallet_ledger_mutation();
  END IF;
END;
$$;

GRANT SELECT,INSERT,UPDATE ON wallet_accounts TO pppoe_app;
GRANT SELECT,INSERT ON wallet_ledger_transactions,wallet_ledger_entries TO pppoe_app;
GRANT USAGE,SELECT ON SEQUENCE wallet_accounts_id_seq,wallet_ledger_transactions_id_seq,wallet_ledger_entries_id_seq TO pppoe_app;
COMMIT;

-- Rollback is release-gated: ledger data must be exported/reconciled first.
-- DROP TABLE wallet_ledger_entries, wallet_ledger_transactions, wallet_accounts;
-- DROP FUNCTION prevent_wallet_ledger_mutation();
