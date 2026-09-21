import crypto from "node:crypto";
import { allocateVpnAddress } from "./vpn-address.js";
import { generateVpnPassword, generateWireGuardKeyPair } from "./wireguard-keys.js";
import { renderVpnClientScript } from "./vpn-client-script.js";

const nameValue=(value)=>{
 const name=String(value||"").trim();
 if(!/^[A-Za-z0-9][A-Za-z0-9 _.-]{2,99}$/.test(name))
  throw Object.assign(new Error("Valid VPN name required"),{status:422});
 return name;
};
const majorValue=(value)=>{
 const major=Number(value);
 if(![6,7].includes(major)) throw Object.assign(new Error("RouterOS version must be 6 or 7"),{status:422});
 return major;
};
const required=(value,label)=>{
 const text=String(value||"").trim();
 if(!text) throw Object.assign(new Error(`${label} is not configured`),{status:503});
 return text;
};
const optionalId=(value,label)=>{
 if(value===undefined||value===null||value==="") return null;
 const id=Number(value);
 if(!Number.isSafeInteger(id)||id<1) throw Object.assign(new Error(`Invalid ${label}`),{status:422});
 return id;
};
const idempotencyValue=value=>{
 const key=String(value||"");
 if(key&&!/^[A-Za-z0-9._:-]{8,128}$/.test(key))
  throw Object.assign(new Error("Invalid Idempotency-Key"),{status:422});
 return key||null;
};
export function vpnRuntimeConfig(env=process.env) {
 return {
  endpointAddress:required(env.VPN_PUBLIC_ENDPOINT,"VPN public endpoint"),
  serverPublicKey:env.VPN_WIREGUARD_PUBLIC_KEY,
  endpointPort:env.VPN_WIREGUARD_PORT||"13231",
  ipsecSecret:env.VPN_L2TP_IPSEC_SECRET,
 };
}
export async function createVpnProfile(pool,input,config) {
 const name=nameValue(input.name),routerOsMajor=majorValue(input.routerOsMajor);
 const actorId=Number(input.actorId),routerId=optionalId(input.routerId,"router ID");
 const idempotencyKey=idempotencyValue(input.idempotencyKey);
 if(!Number.isSafeInteger(actorId)||actorId<1) throw Object.assign(new Error("Invalid actor"),{status:422});
 const protocol=routerOsMajor===7?"wireguard":"l2tp_ipsec";
 const fingerprint=crypto.createHash("sha256").update(JSON.stringify({name,routerOsMajor,routerId})).digest("hex");
 const wireguard=routerOsMajor===7?generateWireGuardKeyPair():null;
 const password=routerOsMajor===6?generateVpnPassword():null;
 const username=routerOsMajor===6?`ngvpn-${generateVpnPassword().slice(0,16)}`:null;
 const db=await pool.connect();
 try {
  await db.query("BEGIN");
  await db.query("select pg_advisory_xact_lock(778001)");
  if(idempotencyKey) {
   const replay=await db.query(`select id,name,host(tunnel_ip) "tunnelIp",status,
    routeros_major "routerOsMajor",protocol,vpn_username "vpnUsername",router_id "routerId",
    request_fingerprint "requestFingerprint"
    from vpn_peers where owner_user_id=$1 and idempotency_key=$2 for update`,[actorId,idempotencyKey]);
   if(replay.rows[0]) {
    if(replay.rows[0].requestFingerprint!==fingerprint)
     throw Object.assign(new Error("Idempotency-Key already used for a different VPN request"),{status:409});
    await db.query("COMMIT");
    return {peer:replay.rows[0],script:null,oneTimeSecret:true,replay:true};
   }
  }
  if(routerId) {
   const router=await db.query(`select id,router_os_version "routerOsVersion" from app_routers
    where id=$1 and owner_user_id=$2 and deleted_at is null for share`,[routerId,actorId]);
   if(!router.rows[0]) throw Object.assign(new Error("Router not found"),{status:404});
   if(Number(router.rows[0].routerOsVersion)!==routerOsMajor)
    throw Object.assign(new Error("Selected RouterOS version does not match router"),{status:422});
  }
  const allocated=await db.query("select host(tunnel_ip) address from vpn_peers");
  const tunnelIp=allocateVpnAddress(allocated.rows.map(row=>row.address));
  const inserted=await db.query(`insert into vpn_peers
   (name,public_key,tunnel_ip,created_by,owner_user_id,routeros_major,protocol,vpn_username,
    router_id,idempotency_key,request_fingerprint)
   values($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10)
   returning id,name,public_key "publicKey",host(tunnel_ip) "tunnelIp",status,
   routeros_major "routerOsMajor",protocol,vpn_username "vpnUsername",router_id "routerId"`,
   [name,wireguard?.publicKey||null,tunnelIp,actorId,routerOsMajor,protocol,username,
    routerId,idempotencyKey,fingerprint]);
  const peer=inserted.rows[0];
  if(routerOsMajor===6) {
   required(config.ipsecSecret,"L2TP/IPsec secret");
   await db.query("insert into radcheck(username,attribute,op,value) values($1,'Cleartext-Password',':=',$2)",[username,password]);
   await db.query("insert into radreply(username,attribute,op,value) values($1,'Framed-IP-Address',':=',$2)",[username,tunnelIp]);
  } else {
   required(config.serverPublicKey,"WireGuard server public key");
  }
  const script=renderVpnClientScript({
   routerOsMajor,peerId:peer.id,tunnelIp,endpointAddress:required(config.endpointAddress,"VPN public endpoint"),
   endpointPort:config.endpointPort,privateKey:wireguard?.privateKey,serverPublicKey:config.serverPublicKey,
   username,password,ipsecSecret:config.ipsecSecret,
  });
  await db.query("insert into vpn_peer_audit(peer_id,actor_user_id,owner_user_id,action) values($1,$2,$2,'Created')",[peer.id,actorId]);
  await db.query("COMMIT");
  return {peer,script,oneTimeSecret:true,replay:false};
 } catch(error) {
  await db.query("ROLLBACK").catch(()=>{});
  if(error.code==="23505") error.status=409;
  throw error;
 } finally { db.release(); }
}
