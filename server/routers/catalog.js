import {validateRouterInput,validateRouterId,requireRouterOwner} from './validation.js';
const notFound=()=>Object.assign(new Error('Router not found'),{status:404});
const conflict=()=>Object.assign(new Error('Router name or endpoint already exists'),{status:409});
const fields='id,name,host,port,router_os_version "routerOsVersion",status,created_at "createdAt",updated_at "updatedAt"';
const handle=e=>{if(e.code==='23505')throw conflict();throw e};
export async function listRouters(db,actor){const owner=requireRouterOwner(actor);const {rows}=await db.query(`SELECT ${fields} FROM app_routers WHERE owner_user_id=$1 AND deleted_at IS NULL ORDER BY name,id`,[owner]);return rows}
export async function createRouter(db,actor,body){const owner=requireRouterOwner(actor),r=validateRouterInput(body);try{const {rows}=await db.query(`INSERT INTO app_routers(owner_user_id,name,host,port,router_os_version,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING ${fields}`,[owner,r.name,r.host,r.port,r.routerOsVersion,r.status]);return rows[0]}catch(e){handle(e)}}
export async function updateRouter(db,actor,idValue,body){const owner=requireRouterOwner(actor),id=validateRouterId(idValue),r=validateRouterInput(body);try{const {rows}=await db.query(`UPDATE app_routers SET name=$3,host=$4,port=$5,router_os_version=$6,status=$7,updated_at=now() WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL RETURNING ${fields}`,[id,owner,r.name,r.host,r.port,r.routerOsVersion,r.status]);if(!rows[0])throw notFound();return rows[0]}catch(e){handle(e)}}
// Fail closed until authoritative router references, credential cleanup and concurrency-safe checks exist.
// Do not remove records based on inferred names or hosts: legacy clients may still depend on them.
export async function deleteRouter(db,actor,idValue){const owner=requireRouterOwner(actor),id=validateRouterId(idValue);const {rows}=await db.query('SELECT id FROM app_routers WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL',[id,owner]);if(!rows[0])throw notFound();throw Object.assign(new Error('Router removal is temporarily unavailable until dependency checks are implemented'),{status:409});}
