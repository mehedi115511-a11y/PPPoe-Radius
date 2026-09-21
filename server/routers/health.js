import { decryptRouterSecret } from './secret-crypto.js';
import { requireRouterOwner, validateRouterId } from './validation.js';
const unavailable=(message,status=503)=>Object.assign(new Error(message),{status});
function credential(value){try{const p=JSON.parse(value);if(!p||typeof p.username!=='string'||!p.username||typeof p.password!=='string'||!p.password)throw new Error();return p}catch{throw unavailable('Stored RouterOS API credential is invalid')}}
export async function checkRouterHealth(db,actor,routerId,keyHex,options={}){
  const owner=requireRouterOwner(actor),id=validateRouterId(routerId);
  if(typeof keyHex!=='string'||!/^[0-9a-f]{64}$/i.test(keyHex))throw unavailable('Router secret encryption is unavailable');
  const {rows}=await db.query(`SELECT r.id,r.host,r.port,r.router_os_version "routerOsVersion",s.encrypted_value "encryptedValue"
    FROM app_routers r LEFT JOIN app_router_secrets s ON s.router_id=r.id AND s.owner_user_id=r.owner_user_id AND s.purpose='router-api'
    WHERE r.id=$1 AND r.owner_user_id=$2 AND r.deleted_at IS NULL`,[id,owner]);
  const router=rows[0];if(!router)throw unavailable('Router not found',404);
  if(!router.encryptedValue)throw unavailable('Router API credential is not configured',409);
  const auth=credential(decryptRouterSecret(router.encryptedValue,{keyHex,ownerId:owner,routerId:id,purpose:'router-api'}));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeoutMs||5000),started=Date.now();
  try{
    const response=await (options.fetchImpl||globalThis.fetch)(`https://${router.host}:${router.port}/rest/system/resource`,{
      signal:controller.signal,headers:{authorization:`Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`,accept:'application/json'}});
    if(!response.ok)throw unavailable('RouterOS health check failed',502);
    const data=await response.json();
    const result={routerId:id,reachable:true,authenticated:true,routerOsVersion:router.routerOsVersion,
      version:typeof data.version==='string'?data.version:null,uptime:typeof data.uptime==='string'?data.uptime:null,
      latencyMs:Date.now()-started,checkedAt:new Date().toISOString()};
    await db.query(`INSERT INTO app_router_audit(router_id,owner_user_id,actor_user_id,action,outcome,details)
      VALUES($1,$2,$3,'HealthChecked','Succeeded',$4)`,[id,owner,owner,result]);
    return result;
  }catch(error){if(error.status)throw error;throw unavailable('RouterOS health check failed',502)}
  finally{clearTimeout(timer)}
}
