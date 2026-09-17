// Pure VPN address allocation: reserving the gateway and broadcast address.
export const VPN_SUBNET = "10.78.0";
export function allocateVpnAddress(assignedAddresses, subnet = VPN_SUBNET) {
  if (!/^10\.78\.0$/.test(subnet)) throw new Error("Unexpected VPN subnet");
  const used = new Set(assignedAddresses);
  for (let host = 2; host <= 254; host++) {
    const address = `${subnet}.${host}`;
    if (!used.has(address)) return address;
  }
  throw new Error("VPN peer address pool exhausted");
}
export function validateWireGuardPublicKey(value) {
  return typeof value === "string" && /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, "base64").length === 32;
}
