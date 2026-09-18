import { generateKeyPairSync, randomBytes } from "node:crypto";
const raw = (value) => Buffer.from(value.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("base64");
export function generateWireGuardKeyPair() {
  const {privateKey,publicKey}=generateKeyPairSync("x25519");
  const privateJwk=privateKey.export({format:"jwk"});
  const publicJwk=publicKey.export({format:"jwk"});
  return Object.freeze({privateKey:raw(privateJwk.d),publicKey:raw(publicJwk.x)});
}
export function generateVpnPassword() {
  return randomBytes(24).toString("base64url");
}
