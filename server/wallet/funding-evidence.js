import {createHash} from "node:crypto";
import {minorUnits,requireIdentity} from "./ledger.js";

const positiveId=(value,label)=>{
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<=0)throw Object.assign(new Error("Invalid "+label),{status:422});
  return number;
};
const conflict=message=>Object.assign(new Error(message),{status:409});
const forbidden=message=>Object.assign(new Error(message),{status:403});
const fingerprint=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const columns=`id,tenant_owner_user_id "tenantOwnerUserId",requested_by_user_id "requestedByUserId",
 provider,external_reference "externalReference",amount_minor::text "amountMinor",
 idempotency_key "idempotencyKey",created_at "createdAt"`;

export async function createFundingRequest(pool,input){
  if(!input.actor||input.actor.status!=="Active"||input.actor.impersonatedBy)
    throw forbidden("Active non-impersonated actor required");
  const tenantId=positiveId(input.actor.id,"tenant");
  const provider=String(input.provider||"").trim().toLowerCase();
  if(!["bank","bkash","nagad","rocket"].includes(provider))
    throw Object.assign(new Error("Invalid funding provider"),{status:422});
  const externalReference=String(input.externalReference||"").trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9/_:-]{5,119}$/.test(externalReference))
    throw Object.assign(new Error("Invalid external payment reference"),{status:422});
  let key,amountMinor;
  try {
    key=requireIdentity(input.idempotencyKey,"idempotency key");
    amountMinor=minorUnits(input.amount);
  } catch(error) {
    if(error instanceof TypeError||error instanceof RangeError)error.status=422;
    throw error;
  }
  if(amountMinor<=0n)throw Object.assign(new Error("Funding amount must be positive"),{status:422});
  const digest=fingerprint({tenantId,provider,externalReference,amountMinor:amountMinor.toString()});
  const db=await pool.connect();
  try{
    await db.query("BEGIN");
    const created=await db.query(`insert into wallet_funding_requests
      (tenant_owner_user_id,requested_by_user_id,provider,external_reference,amount_minor,idempotency_key,request_fingerprint)
      values($1,$1,$2,$3,$4,$5,$6) on conflict(tenant_owner_user_id,idempotency_key) do nothing returning ${columns}`,
      [tenantId,provider,externalReference,amountMinor.toString(),key,digest]);
    if(created.rows[0]){
      await db.query("COMMIT");
      return {...created.rows[0],replay:false};
    }
    const existing=await db.query(`select ${columns},request_fingerprint "requestFingerprint"
      from wallet_funding_requests where tenant_owner_user_id=$1 and idempotency_key=$2`,[tenantId,key]);
    if(!existing.rows[0]||existing.rows[0].requestFingerprint!==digest)
      throw conflict("Idempotency key reused with different funding evidence");
    const {requestFingerprint,...row}=existing.rows[0];
    await db.query("COMMIT");
    return {...row,replay:true};
  }catch(error){
    await db.query("ROLLBACK").catch(()=>{});
    if(error.code==="23505")throw conflict("External payment reference already claimed");
    throw error;
  }finally{db.release()}
}

export async function reviewFundingRequest(pool,input){
  if(input.actor?.role!=="Admin"||input.actor.status!=="Active"||input.actor.impersonatedBy)
    throw forbidden("Active administrator required");
  const requestId=positiveId(input.requestId,"request");
  const decision=String(input.decision||"");
  const note=String(input.note||"").trim();
  if(!["evidence_ok","rejected"].includes(decision)||note.length<4||note.length>500)
    throw Object.assign(new Error("Decision and review note required"),{status:422});
  const db=await pool.connect();
  try{
    await db.query("BEGIN");
    const request=await db.query("select id from wallet_funding_requests where id=$1 FOR SHARE",[requestId]);
    if(!request.rows[0])throw Object.assign(new Error("Funding request not found"),{status:404});
    const created=await db.query(`insert into wallet_funding_reviews(request_id,reviewed_by_user_id,decision,note)
      values($1,$2,$3,$4) on conflict(request_id) do nothing returning id,request_id "requestId",decision,note,created_at "createdAt"`,
      [requestId,input.actor.id,decision,note]);
    if(created.rows[0]){
      await db.query("COMMIT");
      return {...created.rows[0],replay:false};
    }
    const existing=await db.query(`select id,request_id "requestId",decision,note,created_at "createdAt"
      from wallet_funding_reviews where request_id=$1`,[requestId]);
    if(existing.rows[0]?.decision!==decision||existing.rows[0]?.note!==note)
      throw conflict("Funding evidence already reviewed with a different decision");
    await db.query("COMMIT");
    return {...existing.rows[0],replay:true};
  }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error}
  finally{db.release()}
}
