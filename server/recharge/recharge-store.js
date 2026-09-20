import { createHash, randomUUID } from "node:crypto";
import { calculateRechargeAmountMinor } from "./recharge-calculation.js";
import { requireIdentity } from "../wallet/ledger.js";

const parseId = (value, label) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw Object.assign(new Error(`Invalid ${label}`), { status: 422 });
  return parsed;
};
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const columns = `id,receipt_reference "receiptReference",tenant_owner_user_id "tenantOwnerUserId",client_id "clientId",
 package_id "packageId",recharge_mode mode,selected_days "selectedDays",
 to_char(recharge_date,'YYYY-MM-DD') "rechargeDate",calculated_amount_minor "amountMinor",
 to_char(previous_expiry,'YYYY-MM-DD') "previousExpiry",to_char(new_expiry,'YYYY-MM-DD') "newExpiry",
 wallet_ledger_transaction_id "walletTransactionId",idempotency_key "idempotencyKey",
 request_fingerprint "requestFingerprint",created_at "createdAt"`;

const packagePriceMinor = priceText => {
  const price = /^(\d+)(?:\.(\d{1,2}))?$/.exec(priceText);
  if (!price) throw new Error("Invalid package price");
  return BigInt(price[1]) * 100n + BigInt((price[2] || "").padEnd(2, "0"));
};

export async function quoteRecharge(pool, input) {
  const tenantId = parseId(input.actor?.id, "tenant");
  if (input.actor?.status !== "Active") throw Object.assign(new Error("Active actor required"), { status: 403 });
  const clientId = parseId(input.clientId, "client");
  const mode = String(input.mode || "");
  if (!["full_cycle","custom_days"].includes(mode)) throw Object.assign(new Error("Invalid recharge mode"), { status: 422 });
  const selectedDays = mode === "custom_days" ? parseId(input.selectedDays, "selected days") : null;
  const { rows } = await pool.query(
    `select c.expires_at::text previous_expiry,p.price::text package_price,p.validity_days
     from app_clients c join app_packages p on p.id=c.package_id
     where c.id=$1 and c.owner_user_id=$2 and p.owner_user_id=$2`, [clientId,tenantId]);
  if (!rows[0]) throw Object.assign(new Error("Owned client not found"), { status: 404 });
  const amount = calculateRechargeAmountMinor({
    mode, packagePriceMinor:packagePriceMinor(rows[0].package_price),
    selectedDays, validityDays:rows[0].validity_days,
  });
  if (amount <= 0n) throw Object.assign(new Error("Recharge amount must be positive"), { status: 422 });
  const date = (await pool.query("select current_date::text value")).rows[0].value;
  const expiry = (await pool.query(mode === "full_cycle"
    ? "select ($1::date + interval '1 month')::date::text value"
    : "select ($1::date + $2::integer)::date::text value",
    mode === "full_cycle" ? [date] : [date,selectedDays])).rows[0].value;
  return { clientId,mode,selectedDays,rechargeDate:date,amountMinor:amount.toString(),
    previousExpiry:rows[0].previous_expiry,newExpiry:expiry };
}

export async function postRecharge(pool, input) {
  if (!input.actor || input.actor.status !== "Active") throw Object.assign(new Error("Active actor required"), { status: 403 });
  if (input.actor.impersonatedBy) throw Object.assign(new Error("Impersonated financial write denied"), { status: 403 });
  const tenantId = parseId(input.actor.id, "tenant");
  const clientId = parseId(input.clientId, "client");
  const settlementId = parseId(input.settlementOwnerUserId, "settlement owner");
  if (settlementId === tenantId) throw Object.assign(new Error("Settlement wallet must differ"), { status: 422 });
  const mode = String(input.mode || "");
  if (!["full_cycle", "custom_days"].includes(mode)) throw Object.assign(new Error("Invalid recharge mode"), { status: 422 });
  const selectedDays = mode === "custom_days" ? parseId(input.selectedDays, "selected days") : null;
  const key = requireIdentity(input.idempotencyKey, "idempotencyKey");
  const rechargeDate = input.rechargeDate == null ? null : String(input.rechargeDate);
  if (rechargeDate && !/^\d{4}-\d{2}-\d{2}$/.test(rechargeDate)) throw Object.assign(new Error("Invalid recharge date"), { status: 422 });
  const expectedAmountMinor = input.expectedAmountMinor == null ? null : String(input.expectedAmountMinor);
  if (expectedAmountMinor !== null && !/^(0|[1-9]\d*)$/.test(expectedAmountMinor))
    throw Object.assign(new Error("Invalid expected amount"), { status: 422 });
  const requestHash = hash({ tenantId, clientId, settlementId, mode, selectedDays, rechargeDate, expectedAmountMinor });
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("select pg_advisory_xact_lock(hashtextextended($1,$2))",
      [`${tenantId}:${key}`, tenantId]);
    const prior = await db.query(`select ${columns} from app_recharge_receipts where tenant_owner_user_id=$1 and idempotency_key=$2 FOR SHARE`, [tenantId, key]);
    if (prior.rows[0]) {
      if (prior.rows[0].requestFingerprint !== requestHash) throw Object.assign(new Error("Idempotency key reused with different request"), { status: 409 });
      await db.query("COMMIT");
      return { ...prior.rows[0], replay: true };
    }
    const found = await db.query(
      `select c.expires_at,c.owner_user_id,c.package_id,p.price::text package_price,p.validity_days
       from app_clients c join app_packages p on p.id=c.package_id
       where c.id=$1 and c.owner_user_id=$2 and p.owner_user_id=$2 FOR UPDATE OF c`, [clientId, tenantId]);
    const target = found.rows[0];
    if (!target || target.owner_user_id == null) throw Object.assign(new Error("Owned client not found"), { status: 404 });
    const amount = calculateRechargeAmountMinor({ mode, packagePriceMinor:packagePriceMinor(target.package_price), selectedDays, validityDays: target.validity_days });
    if (expectedAmountMinor !== null && amount.toString() !== expectedAmountMinor)
      throw Object.assign(new Error("Recharge quote changed; review the amount again"), { status: 409 });
    if (amount <= 0n)
      throw Object.assign(new Error("Recharge amount must be positive"), { status: 422 });
    const effectiveDate = rechargeDate || (await db.query("select current_date::text value")).rows[0].value;
    const expiry = await db.query(mode === "full_cycle"
      ? "select ($1::date + interval '1 month')::date::text value"
      : "select ($1::date + $2::integer)::date::text value",
      mode === "full_cycle" ? [effectiveDate] : [effectiveDate, selectedDays]);
    const ledger = await db.query(
      `insert into wallet_ledger_transactions
       (tenant_owner_user_id,operation,idempotency_key,request_fingerprint,source_reference,actor_user_id)
       values($1,'client_recharge',$2,$3,$4,$1) returning id`,
      [tenantId, key, requestHash, `client:${clientId}`]);
    const accounts = await db.query(
      "select id,owner_user_id,balance_minor from wallet_accounts where tenant_owner_user_id=$1 and owner_user_id in ($1,$2) order by id FOR UPDATE",
      [tenantId, settlementId]);
    const debit = accounts.rows.find((row) => Number(row.owner_user_id) === tenantId);
    const credit = accounts.rows.find((row) => Number(row.owner_user_id) === settlementId);
    if (!debit || !credit) throw Object.assign(new Error("Exact tenant wallet accounts required"), { status: 422 });
    if (BigInt(debit.balance_minor) < amount) throw Object.assign(new Error("Insufficient wallet balance"), { status: 409 });
    await db.query(`update wallet_accounts set balance_minor=case when id=$1 then balance_minor-$3 else balance_minor+$3 end,
      version=version+1,updated_at=now() where id in($1,$2)`, [debit.id, credit.id, amount.toString()]);
    await db.query("insert into wallet_ledger_entries(transaction_id,wallet_account_id,direction,amount_minor) values($1,$2,'debit',$4),($1,$3,'credit',$4)",
      [ledger.rows[0].id, debit.id, credit.id, amount.toString()]);
    await db.query("update app_clients set expires_at=$1,status='Offline' where id=$2", [expiry.rows[0].value, clientId]);
    const inserted = await db.query(
      `insert into app_recharge_receipts
       (receipt_reference,tenant_owner_user_id,client_id,package_id,actor_user_id,recharge_mode,selected_days,recharge_date,
        calculated_amount_minor,previous_expiry,new_expiry,wallet_ledger_transaction_id,idempotency_key,request_fingerprint)
       values($1,$2,$3,$4,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [`RCH-${randomUUID()}`, tenantId, clientId, target.package_id, mode, selectedDays, effectiveDate, amount.toString(),
       target.expires_at, expiry.rows[0].value, ledger.rows[0].id, key, requestHash]);
    const result = await db.query(`select ${columns} from app_recharge_receipts where id=$1`, [inserted.rows[0].id]);
    await db.query("COMMIT");
    return { ...result.rows[0], replay: false };
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") error.status = 409;
    throw error;
  } finally {
    db.release();
  }
}

export async function reconcileRechargeReceipt(pool, input) {
  if (input.actor?.status !== "Active") throw Object.assign(new Error("Active actor required"), { status: 403 });
  const tenantId = parseId(input.actor.id, "tenant");
  const receiptId = parseId(input.receiptId, "receipt");
  const {rows}=await pool.query(`
    select r.receipt_reference "receiptReference",r.calculated_amount_minor::text "amountMinor",
      r.request_fingerprint "receiptFingerprint",t.request_fingerprint "ledgerFingerprint",
      t.operation,t.tenant_owner_user_id "ledgerTenant",
      count(e.id)::integer "entryCount",count(distinct a.id)::integer "accountCount",
      coalesce(sum(case when e.direction='debit' and a.owner_user_id=$2 then e.amount_minor else 0 end),0)::text "debitMinor",
      coalesce(sum(case when e.direction='credit' and a.owner_user_id<>$2 then e.amount_minor else 0 end),0)::text "creditMinor",
      coalesce(bool_and(a.tenant_owner_user_id=$2),false) "accountsOwned"
    from app_recharge_receipts r
      join wallet_ledger_transactions t on t.id=r.wallet_ledger_transaction_id
      left join wallet_ledger_entries e on e.transaction_id=t.id
      left join wallet_accounts a on a.id=e.wallet_account_id
    where r.id=$1 and r.tenant_owner_user_id=$2
    group by r.id,t.id`,[receiptId,tenantId]);
  const item=rows[0];
  if(!item) throw Object.assign(new Error("Receipt not found"),{status:404});
  const balanced=item.entryCount===2 && item.accountCount===2 && item.accountsOwned &&
    Number(item.ledgerTenant)===tenantId && item.operation==="client_recharge" &&
    item.receiptFingerprint===item.ledgerFingerprint &&
    item.debitMinor===item.amountMinor && item.creditMinor===item.amountMinor;
  return {receiptReference:item.receiptReference,amountMinor:item.amountMinor,
    debitMinor:item.debitMinor,creditMinor:item.creditMinor,entryCount:item.entryCount,
    status:balanced?"balanced":"mismatch"};
}
