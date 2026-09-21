import {validateRouterInput,validateRouterId,requireRouterOwner} from './validation.js';
const notFound=()=>Object.assign(new Error('Router not found'),{status:404});
const conflict=()=>Object.assign(new Error('Router name or endpoint already exists'),{status:409});
const fields='id,name,host,port,router_os_version "routerOsVersion",status,created_at "createdAt",updated_at "updatedAt"';
const handle=e=>{if(e.code==='23505')throw conflict();throw e};
export async function listRouters(db,actor){const owner=requireRouterOwner(actor);const {rows}=await db.query(`SELECT ${fields} FROM app_routers WHERE owner_user_id=$1 AND deleted_at IS NULL ORDER BY name,id`,[owner]);return rows}
export async function createRouter(db,actor,body){const owner=requireRouterOwner(actor),r=validateRouterInput(body);try{const {rows}=await db.query(`INSERT INTO app_routers(owner_user_id,name,host,port,router_os_version,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING ${fields}`,[owner,r.name,r.host,r.port,r.routerOsVersion,r.status]);return rows[0]}catch(e){handle(e)}}
export async function updateRouter(db,actor,idValue,body){const owner=requireRouterOwner(actor),id=validateRouterId(idValue),r=validateRouterInput(body);try{const {rows}=await db.query(`UPDATE app_routers SET name=$3,host=$4,port=$5,router_os_version=$6,status=$7,updated_at=now() WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL RETURNING ${fields}`,[id,owner,r.name,r.host,r.port,r.routerOsVersion,r.status]);if(!rows[0])throw notFound();return rows[0]}catch(e){handle(e)}}
export async function deleteRouter(pool,actor,idValue){
 const owner=requireRouterOwner(actor),id=validateRouterId(idValue),db=await pool.connect();
 try{await db.query('BEGIN');await db.query('select pg_advisory_xact_lock(778116,$1)',[id]);
  const {rows}=await db.query(`SELECT r.id,
   (SELECT count(*)::int FROM app_clients c WHERE c.owner_user_id=r.owner_user_id AND c.router_id=r.id) clients,
   (SELECT count(*)::int FROM app_packages p WHERE p.owner_user_id=r.owner_user_id AND p.router_id=r.id) packages,
   (SELECT count(*)::int FROM app_clients c WHERE c.owner_user_id=r.owner_user_id AND c.router_id IS NULL) "unmappedClients",
   (SELECT count(*)::int FROM app_packages p WHERE p.owner_user_id=r.owner_user_id AND p.router_id IS NULL) "unmappedPackages"
   FROM app_routers r WHERE r.id=$1 AND r.owner_user_id=$2 AND r.deleted_at IS NULL FOR UPDATE`,[id,owner]);
  if(!rows[0])throw notFound();const d=rows[0];
  if(d.clients||d.packages||d.unmappedClients||d.unmappedPackages)throw Object.assign(new Error('Router has linked or unreconciled tenant records'),{status:409});
  await db.query('DELETE FROM app_router_secrets WHERE router_id=$1 AND owner_user_id=$2',[id,owner]);
  await db.query(`UPDATE app_routers SET status='Disabled',deleted_at=now(),updated_at=now() WHERE id=$1 AND owner_user_id=$2`,[id,owner]);
  await db.query(`INSERT INTO app_router_audit(router_id,owner_user_id,actor_user_id,action,outcome,details)
   VALUES($1,$2,$2,'Removed','Succeeded',$3)`,[id,owner,{credentialsRevoked:true}]);
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error}finally{db.release()}
}
