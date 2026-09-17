import { test, expect } from "vitest";
import { renderRouterOsPeerScript } from "./vpn-config.js";
const publicKey = Buffer.alloc(32, 7).toString("base64");
test("generates RouterOS command without private key", () => {
 const script = renderRouterOsPeerScript({ publicKey, tunnelIp: "10.78.0.2" });
 expect(script).toContain("allowed-address=10.78.0.2/32");
 expect(script).toContain(`public-key="${publicKey}"`);
 expect(script).not.toContain("private-key");
});
test("rejects invalid peer, address and interface", () => {
 expect(() => renderRouterOsPeerScript({publicKey: "invalid", tunnelIp:"10.78.0.2"})).toThrow();
 expect(() => renderRouterOsPeerScript({publicKey, tunnelIp:"10.78.0.1"})).toThrow();
 expect(() => renderRouterOsPeerScript({publicKey, tunnelIp:"10.78.0.255"})).toThrow();
 expect(() => renderRouterOsPeerScript({publicKey, tunnelIp:"10.78.0.2", interfaceName:"wg;quit"})).toThrow();
});
