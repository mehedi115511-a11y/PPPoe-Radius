import { createHash } from "node:crypto";
import { assertWalletAccess, minorUnits, requireIdentity } from "./ledger.js";

const positiveId = (value, label) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`Invalid ${label}`);
  return value;
};

export function walletRequestFingerprint(input) {
  const canonical = JSON.stringify({
    tenantOwnerUserId: positiveId(input.tenantOwnerUserId, "tenant owner"),
    actorUserId: positiveId(input.actor?.userId, "actor"),
    operation: requireIdentity(input.operation, "operation"),
    idempotencyKey: requireIdentity(input.idempotencyKey, "idempotencyKey"),
    sourceReference: input.sourceReference == null ? null : requireIdentity(input.sourceReference, "sourceReference"),
    debitOwnerUserId: positiveId(input.debitOwnerUserId, "debit owner"),
    creditOwnerUserId: positiveId(input.creditOwnerUserId, "credit owner"),
    amountMinor: minorUnits(input.amount).toString(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function postWalletTransfer(pool, input) {
  if (!pool?.connect) throw new TypeError("Database pool required");
  if (!input.actor || input.actor.status !== "Active" || input.actor.impersonatedBy) {
    throw new Error("Active non-impersonated actor required");
  }
  assertWalletAccess(input.actor, input.tenantOwnerUserId);
  if (input.debitOwnerUserId === input.creditOwnerUserId) {
    throw new Error("Debit and credit wallets must differ");
  }

  const amountMinor = minorUnits(input.amount);
  if (amountMinor <= 0n) throw new RangeError("Transfer amount must be positive");
  const fingerprint = walletRequestFingerprint(input);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO wallet_ledger_transactions
       (tenant_owner_user_id,operation,idempotency_key,request_fingerprint,source_reference,actor_user_id)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(tenant_owner_user_id,operation,idempotency_key) DO NOTHING
       RETURNING id`,
      [input.tenantOwnerUserId, input.operation, input.idempotencyKey, fingerprint, input.sourceReference ?? null, input.actor.userId],
    );

    if (!inserted.rows[0]) {
      const existing = await client.query(
        `SELECT id,request_fingerprint FROM wallet_ledger_transactions
         WHERE tenant_owner_user_id=$1 AND operation=$2 AND idempotency_key=$3`,
        [input.tenantOwnerUserId, input.operation, input.idempotencyKey],
      );
      if (!existing.rows[0] || existing.rows[0].request_fingerprint !== fingerprint) {
        throw new Error("Idempotency key reused with different request");
      }
      await client.query("COMMIT");
      return Object.freeze({ transactionId: existing.rows[0].id, replay: true });
    }

    const accounts = await client.query(
      `SELECT id,owner_user_id,balance_minor FROM wallet_accounts
       WHERE tenant_owner_user_id=$1 AND owner_user_id IN ($2,$3)
       ORDER BY id FOR UPDATE`,
      [input.tenantOwnerUserId, input.debitOwnerUserId, input.creditOwnerUserId],
    );
    const debit = accounts.rows.find((row) => Number(row.owner_user_id) === input.debitOwnerUserId);
    const credit = accounts.rows.find((row) => Number(row.owner_user_id) === input.creditOwnerUserId);
    if (!debit || !credit) throw new Error("Exact tenant wallet accounts required");
    if (BigInt(debit.balance_minor) < amountMinor) throw new Error("Insufficient wallet balance");

    await client.query(
      `UPDATE wallet_accounts
       SET balance_minor=CASE WHEN id=$1 THEN balance_minor-$3 ELSE balance_minor+$3 END,
           version=version+1,updated_at=now()
       WHERE id IN ($1,$2)`,
      [debit.id, credit.id, amountMinor.toString()],
    );
    await client.query(
      `INSERT INTO wallet_ledger_entries(transaction_id,wallet_account_id,direction,amount_minor)
       VALUES($1,$2,'debit',$4),($1,$3,'credit',$4)`,
      [inserted.rows[0].id, debit.id, credit.id, amountMinor.toString()],
    );
    await client.query("COMMIT");
    return Object.freeze({ transactionId: inserted.rows[0].id, replay: false });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
