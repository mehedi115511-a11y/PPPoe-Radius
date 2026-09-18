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
    const found=await db.query(`select id,public_key "publicKey",host(tunnel_ip) "tunnelIp",status
      from vpn_peers where id=$1 for update`,[peerId]);
    const peer=found.rows[0];
    if (!peer) throw Object.assign(new Error("Peer not found"),{status:404});
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
