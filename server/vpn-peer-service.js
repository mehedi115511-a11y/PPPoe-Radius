const validId = (value, label) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw Object.assign(new Error(`Invalid ${label}`), { status: 422 });
  return parsed;
};
const allowed = {
  Enable: new Set(["Pending","Disabled","SyncError"]),
  Disable: new Set(["Active","Disabled"]),
  Revoke: new Set(["Pending","Active","Disabled","SyncError"]),
};
const targetStatus = { Enable:"Active", Disable:"Disabled", Revoke:"Revoked" };
const safeCode = (error) => {
  if (error instanceof AggregateError) return "COMPENSATION_UNVERIFIED";
  if (/readback/i.test(error?.message || "")) return "READBACK_MISMATCH";
  return "CHR_OPERATION_FAILED";
};

export async function applyPeerOperation(pool, sync, input) {
  if (!pool?.connect || !sync) throw new TypeError("Database and CHR sync required");
  const peerId=validId(input.peerId,"peer ID"), actorId=validId(input.actorId,"actor ID");
  const operation=String(input.operation || "");
  if (!allowed[operation]) throw Object.assign(new Error("Invalid peer operation"),{status:422});
  const db=await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("select pg_advisory_xact_lock(778002,$1)",[peerId]);
    const found=await db.query(`select id,public_key "publicKey",host(tunnel_ip) "tunnelIp",status,protocol
      from vpn_peers where id=$1 for update`,[peerId]);
    const peer=found.rows[0];
    if (!peer) throw Object.assign(new Error("Peer not found"),{status:404});
    if (peer.protocol && peer.protocol !== "wireguard")
      throw Object.assign(new Error("Peer uses protocol-specific activation"),{status:409});
    if (!allowed[operation].has(peer.status)) throw Object.assign(new Error(`Peer cannot ${operation.toLowerCase()} from ${peer.status}`),{status:409});
    const readback=await sync[operation.toLowerCase()](peer);
    const updated=await db.query(`update vpn_peers set status=$2,last_synced_at=now(),last_sync_error=null,
      revoked_at=case when $2='Revoked' then now() else revoked_at end,updated_at=now()
      where id=$1 returning id,status,last_synced_at "lastSyncedAt"`,[peerId,targetStatus[operation]]);
    await db.query(`insert into vpn_peer_sync_attempts(peer_id,actor_user_id,operation,outcome,readback)
      values($1,$2,$3,'Succeeded',$4)`,[peerId,actorId,operation,JSON.stringify(readback)]);
    await db.query("COMMIT");
    return updated.rows[0];
  } catch(error) {
    await db.query("ROLLBACK").catch(()=>{});
    if (error.status) throw error;
    const code=safeCode(error);
    await pool.query(`update vpn_peers set status=case when status='Revoked' then status else 'SyncError' end,
      last_sync_error=$2,updated_at=now() where id=$1`,[peerId,code]).catch(()=>{});
    await pool.query(`insert into vpn_peer_sync_attempts(peer_id,actor_user_id,operation,outcome,error_code)
      values($1,$2,$3,'Failed',$4)`,[peerId,actorId,operation,code]).catch(()=>{});
    throw Object.assign(new Error("CHR synchronization failed"),{status:502,code,cause:error});
  } finally { db.release(); }
}
const assessPeer = (peer, matches) => {
  const expectedAddress=`${peer.tunnelIp}/32`;
  if (peer.status === "Pending") return matches.length === 0 ? null : "PENDING_PRESENT_ON_CHR";
  if (peer.status === "Revoked") return matches.length === 0 ? null : "REVOKED_PRESENT_ON_CHR";
  if (matches.length !== 1) return matches.length ? "DUPLICATE_PUBLIC_KEY" : "PEER_MISSING";
  if (matches[0].allowedAddress !== expectedAddress) return "ALLOWED_ADDRESS_MISMATCH";
  if (peer.status === "Active" && matches[0].disabled !== false) return "DISABLED_STATE_MISMATCH";
  if (peer.status === "Disabled" && matches[0].disabled !== true) return "DISABLED_STATE_MISMATCH";
  if (peer.status === "SyncError") return "SYNC_ERROR_REQUIRES_REVIEW";
  return null;
};

export async function reconcilePeers(pool, sync, actorUserId) {
  const actorId=validId(actorUserId,"actor ID");
  if (typeof sync?.list !== "function") throw new TypeError("CHR readback required");
  const [registryResult,chrPeers]=await Promise.all([
    pool.query(`select id,public_key "publicKey",host(tunnel_ip) "tunnelIp",status from vpn_peers where protocol='wireguard' order by id`),
    sync.list(),
  ]);
  const registry=registryResult.rows;
  const knownKeys=new Set(registry.map(peer=>peer.publicKey));
  const results=registry.map(peer=>{
    const matches=chrPeers.filter(item=>item.publicKey===peer.publicKey);
    const errorCode=assessPeer(peer,matches);
    return {
      peerId:Number(peer.id),status:peer.status,inSync:errorCode===null,errorCode,
      readback:{count:matches.length,allowedAddress:matches[0]?.allowedAddress??null,disabled:matches[0]?.disabled??null},
    };
  });
  const db=await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("select pg_advisory_xact_lock(778003)");
    for (const result of results) {
      await db.query(`insert into vpn_peer_sync_attempts
        (peer_id,actor_user_id,operation,outcome,error_code,readback)
        values($1,$2,'Reconcile',$3,$4,$5)`,[
        result.peerId,actorId,result.inSync?"Succeeded":"Mismatch",result.errorCode,JSON.stringify(result.readback),
      ]);
    }
    await db.query("COMMIT");
  } catch(error) {
    await db.query("ROLLBACK").catch(()=>{});
    throw error;
  } finally { db.release(); }
  return {
    peers:results,total:results.length,mismatches:results.filter(item=>!item.inSync).length,
    unmanagedChrPeers:chrPeers.filter(item=>!knownKeys.has(item.publicKey)).map(item=>({
      id:item.id,allowedAddress:item.allowedAddress,disabled:item.disabled,
    })),
  };
}

export async function revokeL2tpProfile(pool, input) {
  const peerId = validId(input.peerId, "peer ID");
  const actorId = validId(input.actorId, "actor ID");
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const { rows } = await db.query(
      "select id,protocol,vpn_username username,status from vpn_peers where id=$1 for update",
      [peerId],
    );
    const peer = rows[0];
    if (!peer) throw Object.assign(new Error("VPN profile not found"), { status: 404 });
    if (peer.protocol !== "l2tp_ipsec") throw Object.assign(new Error("Profile is not L2TP/IPsec"), { status: 409 });
    if (peer.status === "Revoked") throw Object.assign(new Error("VPN profile already revoked"), { status: 409 });
    await db.query("delete from radcheck where username=$1", [peer.username]);
    await db.query("delete from radreply where username=$1", [peer.username]);
    await db.query("update vpn_peers set status='Revoked',revoked_at=now(),updated_at=now() where id=$1", [peerId]);
    await db.query("insert into vpn_peer_audit(peer_id,actor_user_id,action) values($1,$2,'Revoked')", [peerId, actorId]);
    await db.query("COMMIT");
    return { id: peerId, status: "Revoked" };
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { db.release(); }
}
