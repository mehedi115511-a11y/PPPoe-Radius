import pg from "pg";
import { postRecharge } from "./recharge-store.js";
const { Pool } = pg;
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.includes("pppoe_task44_recharge_")) throw new Error("isolated database required");
const pool = new Pool({ connectionString: url });
const actor = { id: 2, role: "Reseller", status: "Active" };
const call = (clientId, key, mode="full_cycle", selectedDays=null) =>
  postRecharge(pool, { actor, clientId, mode, selectedDays, rechargeDate:"2024-01-31", idempotencyKey:key, settlementOwnerUserId:1 });
const expectReject = async (promise, pattern) => {
  try { await promise; throw new Error("expected rejection"); }
  catch (error) { if (!pattern.test(error.message)) throw error; }
};
const dateText = (value) => value instanceof Date ? value.toISOString().slice(0,10) : String(value);
try {
  await pool.query(`insert into app_users(id,name,username,password_hash,role,status) values
    (1,'Admin','admin','x','Admin','Active'),(2,'Tenant','tenant','x','Reseller','Active'),(3,'Other','other','x','Reseller','Active')`);
  const pkg = await pool.query(`insert into app_packages(name,download_mbps,upload_mbps,price,validity_days,owner_role,owner_user_id)
    values('500 plan',10,10,500,30,'Reseller',2) returning id`);
  const clients = await pool.query(`insert into app_clients(name,username,phone,package_name,router_name,expires_at,monthly_bill,status,owner_role,owner_user_id,package_id)
    values('A','rch-a','1','500 plan','R','2024-01-01',500,'Offline','Reseller',2,$1),
          ('B','rch-b','2','500 plan','R','2024-01-01',500,'Offline','Reseller',2,$1),
          ('Legacy','rch-legacy','3','500 plan','R','2024-01-01',500,'Offline','Reseller',null,$1)
    returning id`, [pkg.rows[0].id]);
  const [a,b,legacy] = clients.rows.map(row => Number(row.id));
  await pool.query("insert into wallet_accounts(tenant_owner_user_id,owner_user_id,balance_minor) values(2,2,300000),(2,1,0)");
  const full = await call(a,"full-1");
  if (BigInt(full.amountMinor)!==50000n || dateText(full.newExpiry)!=="2024-02-29") throw new Error(`full cycle amount/expiry failed ${full.amountMinor}/${dateText(full.newExpiry)}`);
  const replay = await call(a,"full-1");
  if (!replay.replay || replay.receiptReference!==full.receiptReference) throw new Error("exact replay failed");
  await expectReject(call(a,"full-1","custom_days",1), /different request/);
  const custom = await call(b,"custom-1","custom_days",1);
  if (BigInt(custom.amountMinor)!==1667n || dateText(custom.newExpiry)!=="2024-02-01") throw new Error("custom proration/expiry failed");
  const identical = await Promise.all([call(b,"same-concurrent","custom_days",2),call(b,"same-concurrent","custom_days",2)]);
  if (identical.filter(x=>x.replay).length!==1 || identical[0].receiptReference!==identical[1].receiptReference) throw new Error("concurrent identical replay failed");
  await expectReject(postRecharge(pool,{...{actor:{...actor,id:3},clientId:a,mode:"full_cycle",rechargeDate:"2024-01-31",idempotencyKey:"cross",settlementOwnerUserId:1}}),/not found/);
  await expectReject(postRecharge(pool,{actor:{...actor,status:"Suspended"},clientId:a,mode:"full_cycle",idempotencyKey:"suspended",settlementOwnerUserId:1}),/Active actor/);
  await expectReject(postRecharge(pool,{actor:{...actor,impersonatedBy:{id:1}},clientId:a,mode:"full_cycle",idempotencyKey:"imp",settlementOwnerUserId:1}),/Impersonated/);
  await expectReject(call(legacy,"legacy"),/not found/);
  await pool.query("update wallet_accounts set balance_minor=case when owner_user_id=2 then 60000 else 0 end where tenant_owner_user_id=2");
  const different = await Promise.allSettled([call(a,"different-a"),call(b,"different-b")]);
  if (different.filter(x=>x.status==="fulfilled").length!==1 || different.filter(x=>x.status==="rejected").length!==1) throw new Error("concurrent insufficient protection failed");
  const before = await pool.query("select balance_minor from wallet_accounts where tenant_owner_user_id=2 and owner_user_id=2");
  const oldExpiry = await pool.query("select expires_at::text value from app_clients where id=$1",[a]);
  await pool.query(`create function fail_receipt() returns trigger language plpgsql as $$ begin raise exception 'forced receipt failure'; end $$;
    create trigger force_receipt_fail before insert on app_recharge_receipts for each row execute function fail_receipt()`);
  await expectReject(call(a,"rollback-check","custom_days",1),/forced receipt failure/);
  await pool.query("drop trigger force_receipt_fail on app_recharge_receipts; drop function fail_receipt()");
  const after = await pool.query("select balance_minor from wallet_accounts where tenant_owner_user_id=2 and owner_user_id=2");
  const afterExpiry = await pool.query("select expires_at::text value from app_clients where id=$1",[a]);
  if (before.rows[0].balance_minor!==after.rows[0].balance_minor || oldExpiry.rows[0].value!==afterExpiry.rows[0].value) throw new Error("rollback atomicity failed");
  const balanced = await pool.query(`select transaction_id,sum(case direction when 'debit' then -amount_minor else amount_minor end)::bigint net
    from wallet_ledger_entries group by transaction_id having sum(case direction when 'debit' then -amount_minor else amount_minor end)<>0`);
  if (balanced.rowCount) throw new Error("unbalanced ledger");
  await expectReject(pool.query("update wallet_ledger_entries set amount_minor=1 where id=(select min(id) from wallet_ledger_entries)"),/append-only/);
  await expectReject(pool.query("delete from app_recharge_receipts where id=$1",[full.id]),/immutable/);
  const counts=await pool.query("select count(*)::int receipts from app_recharge_receipts");
  console.log(`RECHARGE_INTEGRATION_PASS receipts=${counts.rows[0].receipts} replay=1 identical_concurrency=1 insufficient_concurrency=1 rollback=1 balanced=1 immutable=1`);
} finally { await pool.end(); }
