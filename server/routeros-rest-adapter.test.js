import { expect, test, vi } from "vitest";
import { createRouterOsRestAdapter } from "./routeros-rest-adapter.js";
const response = (status, body=null) => ({ ok: status>=200&&status<300, status, json: vi.fn(async()=>body) });
const config = (fetchImpl) => ({ baseUrl:"https://chr.test/",username:"api",password:"secret",interfaceName:"wg-radius",fetchImpl,backoffMs:0,timeoutMs:500 });
test("lists and normalizes RouterOS peers without exposing credentials", async () => {
  const fetchImpl=vi.fn(async()=>response(200,[{".id":"*1","public-key":"key","allowed-address":"10.78.0.2/32",disabled:"false"}]));
  const peers=await createRouterOsRestAdapter(config(fetchImpl)).listPeers();
  expect(peers).toEqual([{id:"*1",publicKey:"key",allowedAddress:"10.78.0.2/32",disabled:false}]);
  expect(fetchImpl.mock.calls[0][0].toString()).not.toContain("secret");
  expect(fetchImpl.mock.calls[0][1].headers.authorization).toMatch(/^Basic /);
});
test("adds, changes and removes a peer using RouterOS REST verbs", async () => {
  const fetchImpl=vi.fn(async()=>response(204));
  const adapter=createRouterOsRestAdapter(config(fetchImpl));
  await adapter.addPeer({publicKey:"key",allowedAddress:"10.78.0.2/32",disabled:false});
  await adapter.setPeer("*1",{disabled:true});
  await adapter.removePeer("*1");
  expect(fetchImpl.mock.calls.map(call=>call[1].method)).toEqual(["PUT","PATCH","DELETE"]);
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body).interface).toBe("wg-radius");
});
test("retries transient responses and rejects permanent failures", async () => {
  const transient=vi.fn().mockResolvedValueOnce(response(503)).mockResolvedValueOnce(response(200,[]));
  await expect(createRouterOsRestAdapter(config(transient)).listPeers()).resolves.toEqual([]);
  expect(transient).toHaveBeenCalledTimes(2);
  const permanent=vi.fn(async()=>response(401));
  await expect(createRouterOsRestAdapter(config(permanent)).listPeers()).rejects.toThrow("operation failed");
  expect(permanent).toHaveBeenCalledTimes(1);
});
test("requires HTTPS by default and returns secret-safe errors", async () => {
  expect(()=>createRouterOsRestAdapter({...config(vi.fn()),baseUrl:"http://chr.test/"})).toThrow("HTTPS");
  const fetchImpl=vi.fn(async()=>{ throw new Error("network detail"); });
  await expect(createRouterOsRestAdapter(config(fetchImpl)).listPeers()).rejects.not.toThrow("secret");
});
