import pg from "pg";
import { postWalletTransfer } from "./wallet-store.js";

const { Pool } = pg;
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.includes("pppoe_task44_wallet_")) {
  throw new Error("Refusing to run without an isolated pppoe_task44_wallet_ database");
}
const pool = new Pool({ connectionString: databaseUrl });
const actor = { userId: 2, role: "Reseller", status: "Active" };
const request = (key, amount) => ({
  tenantOwnerUserId: 2,
  actor,
  operation: "recharge",
  idempotencyKey: key,
  sourceReference: key,
  debitOwnerUserId: 2,
  creditOwnerUserId: 3,
  amount,
});

try {
  await pool.query(
    `INSERT INTO wallet_accounts(tenant_owner_user_id,owner_user_id,balance_minor)
     VALUES(2,2,100000),(2,3,0)`,
  );

  const first = await postWalletTransfer(pool, request("wallet-int-1", "600.00"));
  if (first.replay) throw new Error("first transfer incorrectly marked replay");
  const replay = await postWalletTransfer(pool, request("wallet-int-1", "600.00"));
  if (!replay.replay || Number(replay.transactionId) !== Number(first.transactionId)) {
    throw new Error("idempotent replay did not return original transaction");
  }
  await postWalletTransfer(pool, request("wallet-int-1", "601.00"))
    .then(() => { throw new Error("changed idempotent request unexpectedly accepted"); })
    .catch((error) => {
      if (!/different request/.test(error.message)) throw error;
    });

  const concurrent = await Promise.allSettled([
    postWalletTransfer(pool, request("wallet-int-2", "300.00")),
    postWalletTransfer(pool, request("wallet-int-3", "300.00")),
  ]);
  const passed = concurrent.filter((result) => result.status === "fulfilled");
  const failed = concurrent.filter((result) => result.status === "rejected");
  if (passed.length !== 1 || failed.length !== 1 || !/Insufficient/.test(failed[0].reason.message)) {
    throw new Error("concurrent insufficient-balance protection failed");
  }

  const balances = await pool.query(
    `SELECT owner_user_id,balance_minor FROM wallet_accounts
     WHERE tenant_owner_user_id=2 ORDER BY owner_user_id`,
  );
  const debit = BigInt(balances.rows[0].balance_minor);
  const credit = BigInt(balances.rows[1].balance_minor);
  if (debit !== 10000n || credit !== 90000n) {
    throw new Error(`unexpected balances ${debit}/${credit}`);
  }
  const counts = await pool.query(
    `SELECT
      (SELECT count(*)::int FROM wallet_ledger_transactions) transactions,
      (SELECT count(*)::int FROM wallet_ledger_entries) entries`,
  );
  if (counts.rows[0].transactions !== 2 || counts.rows[0].entries !== 4) {
    throw new Error("ledger transaction/entry counts are inconsistent");
  }
  console.log(`WALLET_STORE_INTEGRATION_PASS debit=${debit} credit=${credit} transactions=2 entries=4 replay=1 concurrency=1`);
} finally {
  await pool.end();
}
