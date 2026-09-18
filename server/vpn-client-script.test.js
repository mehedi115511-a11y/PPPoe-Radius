import { expect,test } from "vitest";
import { generateWireGuardKeyPair } from "./wireguard-keys.js";
import { renderMikroTikVpnClientScript, renderVpnClientScript } from "./vpn-client-script.js";
test("generates RouterOS-compatible 32-byte WireGuard key pairs",()=>{
 const pair=generateWireGuardKeyPair();
 expect(Buffer.from(pair.privateKey,"base64")).toHaveLength(32);
 expect(Buffer.from(pair.publicKey,"base64")).toHaveLength(32);
 expect(pair.privateKey).not.toBe(pair.publicKey);
});
test("renders a complete one-paste MikroTik client script",()=>{
 const client=generateWireGuardKeyPair(),server=generateWireGuardKeyPair();
 const value=renderMikroTikVpnClientScript({peerId:7,privateKey:client.privateKey,serverPublicKey:server.publicKey,
  tunnelIp:"10.78.0.7",endpointAddress:"vpn.example.com",endpointPort:13231});
 expect(value).toContain("/interface/wireguard/add");
 expect(value).toContain("/ip/address/add address=10.78.0.7/32");
 expect(value).toContain("allowed-address=10.78.0.0/24");
 expect(value).toContain("persistent-keepalive=25s");
 expect(value).toContain(client.privateKey);
});
test("rejects unsafe endpoint and invalid keys",()=>{
 expect(()=>renderMikroTikVpnClientScript({privateKey:"bad",serverPublicKey:"bad"})).toThrow("key");
});
test("renders RouterOS 6 L2TP/IPsec one-paste script",()=>{
 const value=renderVpnClientScript({routerOsMajor:6,peerId:9,endpointAddress:"vpn.example.com",
  username:"nextgan-user-9",password:"Password_123456",ipsecSecret:"IpsecSecret_123456"});
 expect(value).toContain("l2tp-client/add");
 expect(value).toContain("use-ipsec=yes");
 expect(value).toContain("authentication=mschap2");
});
test("selects RouterOS 7 WireGuard and rejects unsupported versions",()=>{
 const client=generateWireGuardKeyPair(),server=generateWireGuardKeyPair();
 expect(renderVpnClientScript({routerOsMajor:7,peerId:7,privateKey:client.privateKey,
  serverPublicKey:server.publicKey,tunnelIp:"10.78.0.7",endpointAddress:"vpn.example.com",endpointPort:13231}))
  .toContain("wireguard/add");
 expect(()=>renderVpnClientScript({routerOsMajor:5})).toThrow("6 or 7");
});
