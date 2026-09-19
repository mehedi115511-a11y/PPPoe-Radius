import { expect, test } from "vitest";
import { vpnReadiness } from "./vpn-readiness.js";
import { generateWireGuardKeyPair } from "./wireguard-keys.js";

test("reports per-version prerequisites without exposing secrets", () => {
  const settings = vpnReadiness({
    VPN_PUBLIC_ENDPOINT:"vpn.example.com",
    VPN_WIREGUARD_PUBLIC_KEY:generateWireGuardKeyPair().publicKey,
    VPN_L2TP_IPSEC_SECRET:"secret-example-123456",
    CHR_ROUTEROS_REST_URL:"https://chr.example.com/",
    CHR_ROUTEROS_USERNAME:"service",
    CHR_ROUTEROS_PASSWORD:"private-secret",
    CHR_WIREGUARD_INTERFACE:"wg1",
  });
  expect(settings.routerOs6.ready).toBe(true);
  expect(settings.routerOs7.ready).toBe(true);
  expect(settings.chrSync.ready).toBe(true);
  expect(JSON.stringify(settings)).not.toContain("private-secret");
});
test("missing CHR credentials and invalid key fail readiness", () => {
  const settings = vpnReadiness({VPN_PUBLIC_ENDPOINT:"vpn.example.com",VPN_WIREGUARD_PUBLIC_KEY:"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",CHR_ROUTEROS_REST_URL:"http://chr.example.com"});
  expect(settings.routerOs7.ready).toBe(false);
  expect(settings.chrSync.missing).toContain("CHR_ROUTEROS_REST_URL (HTTPS)");
  expect(settings.chrSync.missing).toContain("CHR_ROUTEROS_PASSWORD");
});
