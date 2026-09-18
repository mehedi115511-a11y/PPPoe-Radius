import { expect,test,vi } from "vitest";
import { createVpnProfile } from "./vpn-profile-create.js";
import { generateWireGuardKeyPair } from "./wireguard-keys.js";
function harness(){
 let id=10;
 const client={release:vi.fn(),query:vi.fn(async(sql,args)=>{
  if(/select host/.test(sql)) return {rows:[{address:"10.78.0.2"}]};
  if(/insert into vpn_peers/.test(sql)) return {rows:[{id:id++,name:args[0],publicKey:args[1],tunnelIp:args[2],
    status:"Pending",routerOsMajor:args[4],protocol:args[5],vpnUsername:args[6]}]};
  return {rows:[]};
 })};
 return {pool:{connect:vi.fn(async()=>client)},client};
}
const config=()=>({endpointAddress:"vpn.example.com",endpointPort:"13231",
 serverPublicKey:generateWireGuardKeyPair().publicKey,ipsecSecret:"IpsecSecret_123456"});
test("creates RouterOS 7 profile and returns one-time WireGuard script",async()=>{
 const {pool,client}=harness();
 const result=await createVpnProfile(pool,{name:"Branch 7",routerOsMajor:7,actorId:1},config());
 expect(result.peer).toMatchObject({routerOsMajor:7,protocol:"wireguard",tunnelIp:"10.78.0.3"});
 expect(result.script).toContain("wireguard/add");
 expect(result.oneTimeSecret).toBe(true);
 expect(client.query.mock.calls.some(([sql])=>/radcheck/.test(sql))).toBe(false);
 expect(client.query).toHaveBeenLastCalledWith("COMMIT");
});
test("creates RouterOS 6 RADIUS credentials and L2TP/IPsec script atomically",async()=>{
 const {pool,client}=harness();
 const result=await createVpnProfile(pool,{name:"Branch 6",routerOsMajor:6,actorId:1},config());
 expect(result.peer).toMatchObject({routerOsMajor:6,protocol:"l2tp_ipsec"});
 expect(result.script).toContain("l2tp-client/add");
 expect(result.script).toContain("use-ipsec=yes");
 expect(client.query.mock.calls.some(([sql])=>/insert into radcheck/.test(sql))).toBe(true);
 expect(client.query.mock.calls.some(([sql])=>/insert into radreply/.test(sql))).toBe(true);
});
test("invalid version and missing runtime settings fail closed",async()=>{
 const {pool}=harness();
 await expect(createVpnProfile(pool,{name:"Branch",routerOsMajor:5,actorId:1},config())).rejects.toMatchObject({status:422});
 const os6=harness();
 await expect(createVpnProfile(os6.pool,{name:"Branch 6",routerOsMajor:6,actorId:1},{...config(),ipsecSecret:""})).rejects.toMatchObject({status:503});
 expect(os6.client.query).toHaveBeenCalledWith("ROLLBACK");
});
