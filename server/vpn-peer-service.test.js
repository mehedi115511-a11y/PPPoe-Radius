import { expect, test, vi } from "vitest";
import { applyPeerOperation, reconcilePeers } from "./vpn-peer-service.js";
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
test("reconciliation audits exact state, mismatches and unmanaged CHR peers",async()=>{
  const publicKey=Buffer.alloc(32,4).toString("base64");
  const otherKey=Buffer.alloc(32,5).toString("base64");
  const registry=[
    {id:1,publicKey,tunnelIp:"10.78.0.7",status:"Active"},
    {id:2,publicKey:otherKey,tunnelIp:"10.78.0.8",status:"Disabled"},
    {id:3,publicKey:"revoked",tunnelIp:"10.78.0.9",status:"Revoked"},
  ];
  const client={release:vi.fn(),query:vi.fn(async()=>({rows:[]}))};
  const pool={
    query:vi.fn(async()=>({rows:registry})),
    connect:vi.fn(async()=>client),
  };
  const unmanaged=Buffer.alloc(32,6).toString("base64");
  const sync={list:vi.fn(async()=>[
    {id:"*1",publicKey,allowedAddress:"10.78.0.7/32",disabled:false},
    {id:"*2",publicKey:otherKey,allowedAddress:"10.78.0.8/32",disabled:false},
    {id:"*9",publicKey:unmanaged,allowedAddress:"10.78.0.99/32",disabled:false},
  ])};
  const result=await reconcilePeers(pool,sync,1);
  expect(result).toMatchObject({total:3,mismatches:1});
  expect(result.peers.map(item=>item.errorCode)).toEqual([null,"DISABLED_STATE_MISMATCH",null]);
  expect(result.unmanagedChrPeers).toEqual([{id:"*9",allowedAddress:"10.78.0.99/32",disabled:false}]);
  expect(client.query.mock.calls.filter(([sql])=>/insert into vpn_peer_sync_attempts/.test(sql))).toHaveLength(3);
  expect(client.query).toHaveBeenLastCalledWith("COMMIT");
});
test("reconciliation rolls back if audit persistence fails",async()=>{
  const client={release:vi.fn(),query:vi.fn(async(sql)=>{
    if (/insert into vpn_peer_sync_attempts/.test(sql)) throw new Error("audit unavailable");
    return {rows:[]};
  })};
  const pool={query:vi.fn(async()=>({rows:[{id:1,publicKey:"k",tunnelIp:"10.78.0.2",status:"Pending"}]})),connect:vi.fn(async()=>client)};
  await expect(reconcilePeers(pool,{list:vi.fn(async()=>[])},1)).rejects.toThrow("audit unavailable");
  expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  expect(client.release).toHaveBeenCalled();
});
