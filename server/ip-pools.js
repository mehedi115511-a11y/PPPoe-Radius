import {isIP} from "node:net";
const invalid=message=>Object.assign(new Error(message),{status:422});
const conflict=message=>Object.assign(new Error(message),{status:409});
const missing=()=>Object.assign(new Error("IP pool not found"),{status:404});
const owner=actor=>{
 if(!actor||actor.status!=="Active"||actor.impersonatedBy||!Number.isSafeInteger(Number(actor.id))||Number(actor.id)<=0)
   throw Object.assign(new Error("Active own-tenant session required"),{status:403});
 return Number(actor.id);
};
const poolId=value=>{
 const id=Number(value);
 if(!/^[1-9][0-9]*$/.test(String(value))||!Number.isSafeInteger(id))throw invalid("Invalid IP pool ID");
 return id;
};
export function parseIpPool(body){
 const name=String(body?.name??"").trim(),network=String(body?.network??"").trim();
 const status=body?.status??"Active";
 if(name.length<2||name.length>80||!["Active","Disabled"].includes(status))throw invalid("Invalid IP pool fields");
 const parts=network.split("/");
 if(parts.length!==2||isIP(parts[0])!==4||!/^\d{1,2}$/.test(parts[1])||Number(parts[1])<8||Number(parts[1])>30)
   throw invalid("IPv4 network CIDR (/8 to /30) required");
 const octets=parts[0].split(".").map(Number),prefix=Number(parts[1]);
 if(octets.some((n,i)=>String(n)!==parts[0].split(".")[i]))throw invalid("Canonical IPv4 network required");
 const address=octets.reduce((n,x)=>((n<<8)|x)>>>0,0),mask=(0xffffffff<<(32-prefix))>>>0;
 if((address&mask)!==address)throw invalid("CIDR must start at the network address");
 return {name,network,status};
}
const fields='id,name,network::text network,status,created_at "createdAt",updated_at "updatedAt"';
export async function listIpPools(db,actor){
 const result=await db.query(`select ${fields} from app_ip_pools where owner_user_id=$1 order by name,id`,[owner(actor)]);
 return result.rows;
}
export async function saveIpPool(pool,actor,body,idValue){
 const userId=owner(actor),value=parseIpPool(body),id=idValue===undefined?null:poolId(idValue);
 const db=await pool.connect();
 try{
  await db.query("BEGIN");
  await db.query("select pg_advisory_xact_lock(778115,$1)",[userId]);
  if(id!==null){
   const exists=await db.query("select id from app_ip_pools where id=$1 and owner_user_id=$2 for update",[id,userId]);
   if(!exists.rows[0])throw missing();
  }
  const overlapping=await db.query("select id from app_ip_pools where owner_user_id=$1 and network && $2::cidr and ($3::bigint is null or id<>$3) limit 1",[userId,value.network,id]);
  if(overlapping.rows[0])throw conflict("IP pool overlaps an existing tenant pool");
  const result=id===null
   ? await db.query(`insert into app_ip_pools(owner_user_id,name,network,status) values($1,$2,$3,$4) returning ${fields}`,[userId,value.name,value.network,value.status])
   : await db.query(`update app_ip_pools set name=$3,network=$4,status=$5,updated_at=now() where id=$1 and owner_user_id=$2 returning ${fields}`,[id,userId,value.name,value.network,value.status]);
  await db.query("COMMIT");
  return result.rows[0];
 }catch(error){
  await db.query("ROLLBACK").catch(()=>{});
  if(error.code==="23505")throw conflict("IP pool name or network already exists");
  if(error.code==="22P02")throw invalid("Invalid IPv4 CIDR");
  throw error;
 }finally{db.release()}
}
export async function deleteIpPool(pool,actor,idValue){
 const userId=owner(actor),id=poolId(idValue);
 const result=await pool.query("delete from app_ip_pools where id=$1 and owner_user_id=$2 returning id",[id,userId]);
 if(!result.rows[0])throw missing();
}
