import { expect, test, vi } from "vitest";
import { applyPeerOperation } from "./vpn-peer-service.js";
const peer={id:7,publicKey:Buffer.alloc(32,4).toString("base64"),tunnelIp:"10.78.0.7",status:"Pending"};
function harness(current=peer) {
  const state={...current};
  const client={release:vi.fn(),query:vi.fn(async(sql,args)=>{
    if (/select id,public_key/.test(sql)) return {rows:[{...state}]};
    if (/update vpn_peers set status=/.test(sql)) { state.status=args[1]; return {rows:[{id:state.id,status:state.status,lastSyncedAt:new Date()}]}; }
    return {rows:[]};
  })};
  const pool={connect:vi.fn(async()=>client),query:vi.fn(async()=>({rows:[]}))};
  const sync={enable:vi.fn(async()=>({id:"*7"})),disable:vi.fn(async()=>({id:"*7"})),revoke:vi.fn(async()=>({revoked:true}))};
  return {pool,client,sync,state};
}
test("enables with readback then persists active state and audit in one transaction",async()=>{
  const {pool,client,sync}=harness();
  await expect(applyPeerOperation(pool,sync,{peerId:7,actorId:1,operation:"Enable"})).resolves.toMatchObject({status:"Active"});
  expect(sync.enable).toHaveBeenCalledWith(expect.objectContaining({tunnelIp:"10.78.0.7"}));
  expect(client.query.mock.calls.some(([sql])=>/vpn_peer_sync_attempts/.test(sql))).toBe(true);
  expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  expect(client.release).toHaveBeenCalled();
});
test("disables active and revokes disabled peers",async()=>{
  const disabled=harness({...peer,status:"Active"});
  await expect(applyPeerOperation(disabled.pool,disabled.sync,{peerId:7,actorId:1,operation:"Disable"})).resolves.toMatchObject({status:"Disabled"});
  const revoked=harness({...peer,status:"Disabled"});
  await expect(applyPeerOperation(revoked.pool,revoked.sync,{peerId:7,actorId:1,operation:"Revoke"})).resolves.toMatchObject({status:"Revoked"});
});
test("invalid transition fails before a CHR write",async()=>{
  const {pool,sync}=harness({...peer,status:"Revoked"});
  await expect(applyPeerOperation(pool,sync,{peerId:7,actorId:1,operation:"Enable"})).rejects.toMatchObject({status:409});
  expect(sync.enable).not.toHaveBeenCalled();
});
test("CHR failure rolls back, records sanitized failure and marks SyncError",async()=>{
  const {pool,client,sync}=harness();
  sync.enable.mockRejectedValue(new Error("socket failed with secret detail"));
  await expect(applyPeerOperation(pool,sync,{peerId:7,actorId:1,operation:"Enable"})).rejects.toMatchObject({status:502,code:"CHR_OPERATION_FAILED"});
  expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  expect(pool.query.mock.calls.flat().join(" ")).not.toContain("secret detail");
  expect(pool.query.mock.calls.some(([sql,args])=>/last_sync_error/.test(sql)&&args[1]==="CHR_OPERATION_FAILED")).toBe(true);
});
