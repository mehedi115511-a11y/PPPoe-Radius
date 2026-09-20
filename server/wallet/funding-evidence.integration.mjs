import pg from "pg";
import {createFundingRequest,reviewFundingRequest} from "./funding-evidence.js";
const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.includes("pppoe_funding_test_"))
  throw new Error("isolated pppoe_funding_test_ database required");
const pool=new pg.Pool({connectionString:url});
const actor={id:2,role:"Reseller",status:"Active"};
const evidence={actor,provider:"bkash",externalReference:"TXN-A12345",amount:"500.00",idempotencyKey:"pay-1"};
async function rejects(task,pattern){
  try{await task;throw new Error("expected rejection")}
  catch(error){if(!pattern.test(error.message))throw error}
}
try{
  await pool.query(`insert into app_users(id,name,username,password_hash,role,status) values
    (1,'Admin','fund-admin','x','Admin','Active'),
    (2,'Tenant','fund-tenant','x','Reseller','Active'),
    (3,'Other','fund-other','x','Reseller','Active')`);
  await pool.query("insert into wallet_accounts(tenant_owner_user_id,owner_user_id) values(2,2),(2,1),(3,3)");
  const first=await createFundingRequest(pool,evidence);
  if(first.replay||first.amountMinor!=="50000")throw new Error("request amount");
  const replay=await createFundingRequest(pool,evidence);
  if(!replay.replay||replay.id!==first.id)throw new Error("exact replay");
  await rejects(createFundingRequest(pool,{...evidence,amount:"501.00"}),/different funding/);
  await rejects(createFundingRequest(pool,{...evidence,actor:{...actor,id:3},idempotencyKey:"other"}),/reference already claimed/);
  await rejects(createFundingRequest(pool,{...evidence,actor:{...actor,status:"Suspended"}}),/non-impersonated/);
  await rejects(createFundingRequest(pool,{...evidence,actor:{...actor,impersonatedBy:{id:1}}}),/non-impersonated/);
  await rejects(reviewFundingRequest(pool,{actor,requestId:first.id,decision:"evidence_ok",note:"verified payment reference"}),/administrator/);
  const admin={id:1,role:"Admin",status:"Active"};
  const review=await reviewFundingRequest(pool,{actor:admin,requestId:first.id,decision:"evidence_ok",note:"Evidence checked; no wallet credit"});
  if(review.replay||review.decision!=="evidence_ok")throw new Error("review");
  const same=await reviewFundingRequest(pool,{actor:admin,requestId:first.id,decision:"evidence_ok",note:"Evidence checked; no wallet credit"});
  if(!same.replay||same.id!==review.id)throw new Error("review replay");
  await rejects(reviewFundingRequest(pool,{actor:admin,requestId:first.id,decision:"rejected",note:"different decision"}),/different decision/);
  await rejects(reviewFundingRequest(pool,{actor:{...admin,impersonatedBy:{id:2}},requestId:first.id,decision:"evidence_ok",note:"another note"}),/administrator/);
  await rejects(pool.query("update wallet_funding_requests set amount_minor=1 where id=$1",[first.id]),/append-only/);
  await rejects(pool.query("delete from wallet_funding_reviews where id=$1",[review.id]),/append-only/);
  const balances=await pool.query("select coalesce(sum(balance_minor),0)::text total from wallet_accounts");
  const ledger=await pool.query("select count(*)::int n from wallet_ledger_entries");
  if(balances.rows[0].total!=="0"||ledger.rows[0].n!==0)throw new Error("Evidence changed wallet");
  console.log("FUNDING_EVIDENCE_PASS requests=1 reviews=1 replay=1 duplicate_reference=1 tenant_denials=1 immutable=1 balances=0 ledger_entries=0");
}finally{await pool.end()}
