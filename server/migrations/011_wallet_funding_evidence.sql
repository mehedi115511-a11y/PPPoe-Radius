-- External funding evidence only. This migration never credits a wallet.
BEGIN;
CREATE TABLE IF NOT EXISTS wallet_funding_requests (
  id bigserial PRIMARY KEY,
  tenant_owner_user_id bigint NOT NULL REFERENCES app_users(id),
  requested_by_user_id bigint NOT NULL REFERENCES app_users(id),
  provider text NOT NULL CHECK(provider IN ('bank','bkash','nagad','rocket')),
  external_reference text NOT NULL CHECK(length(external_reference) BETWEEN 6 AND 120),
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$'),
  request_fingerprint text NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_owner_user_id,idempotency_key),
  UNIQUE(provider,external_reference)
);
CREATE INDEX IF NOT EXISTS wallet_funding_requests_tenant_created_idx
  ON wallet_funding_requests(tenant_owner_user_id,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS wallet_funding_reviews (
  id bigserial PRIMARY KEY,
  request_id bigint NOT NULL UNIQUE REFERENCES wallet_funding_requests(id),
  reviewed_by_user_id bigint NOT NULL REFERENCES app_users(id),
  decision text NOT NULL CHECK(decision IN ('evidence_ok','rejected')),
  note text NOT NULL CHECK(length(note) BETWEEN 4 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION prevent_wallet_funding_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'wallet funding evidence is append-only'; END;
$$;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='funding_requests_immutable') THEN
    CREATE TRIGGER funding_requests_immutable BEFORE UPDATE OR DELETE ON wallet_funding_requests
      FOR EACH ROW EXECUTE FUNCTION prevent_wallet_funding_evidence_mutation();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='funding_reviews_immutable') THEN
    CREATE TRIGGER funding_reviews_immutable BEFORE UPDATE OR DELETE ON wallet_funding_reviews
      FOR EACH ROW EXECUTE FUNCTION prevent_wallet_funding_evidence_mutation();
  END IF;
END;
$$;
GRANT SELECT,INSERT ON wallet_funding_requests,wallet_funding_reviews TO pppoe_app;
GRANT USAGE,SELECT ON SEQUENCE wallet_funding_requests_id_seq,wallet_funding_reviews_id_seq TO pppoe_app;
COMMIT;
-- Rollback is release-gated: export evidence/reviews first, then DROP TABLE wallet_funding_reviews,wallet_funding_requests.
