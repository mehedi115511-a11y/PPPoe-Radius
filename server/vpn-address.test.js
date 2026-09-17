import { expect, test } from "vitest";
import { allocateVpnAddress, validateWireGuardPublicKey } from "./vpn-address.js";
test("allocates free addresses", () => { expect(allocateVpnAddress([])).toBe("10.78.0.2"); expect(allocateVpnAddress(["10.78.0.2"])).toBe("10.78.0.3"); });
test("rejects exhausted pools", () => { const used = Array.from({length:253}, (_, i) => `10.78.0.${i+2}`); expect(() => allocateVpnAddress(used)).toThrow("exhausted"); });
test("checks key length", () => { expect(validateWireGuardPublicKey(Buffer.alloc(32,1).toString("base64"))).toBe(true); expect(validateWireGuardPublicKey("abc")).toBe(false); });

test("rejects zero and noncanonical keys", () => { expect(validateWireGuardPublicKey(Buffer.alloc(32).toString("base64"))).toBe(false); expect(validateWireGuardPublicKey(Buffer.alloc(32,1).toString("base64"))).toBe(true); expect(validateWireGuardPublicKey("A".repeat(42)+"B=")).toBe(false); });
