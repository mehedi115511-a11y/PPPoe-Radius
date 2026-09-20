import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const invalidKey = () => new Error('Router secret encryption key is not configured');
function keyFromHex(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]{64}$/i.test(hex)) throw invalidKey();
  return Buffer.from(hex, 'hex');
}
function aadFor(ownerId, routerId, purpose) {
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0 || !Number.isSafeInteger(routerId) || routerId <= 0 || !['router-api', 'radius-shared-secret'].includes(purpose)) throw new Error('Invalid router secret context');
  return Buffer.from(`${ownerId}:${routerId}:${purpose}`, 'utf8');
}
/** Does not read environment variables, access databases, or configure devices. Callers must supply a server-only 32-byte key as 64 hex characters. */
export function encryptRouterSecret(plaintext, { keyHex, ownerId, routerId, purpose }) {
  const key = keyFromHex(keyHex), aad = aadFor(ownerId, routerId, purpose);
  if (typeof plaintext !== 'string' || !plaintext.length) throw new Error('Router secret must be a nonempty string');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}
export function decryptRouterSecret(envelope, { keyHex, ownerId, routerId, purpose }) {
  const key = keyFromHex(keyHex), aad = aadFor(ownerId, routerId, purpose);
  if (typeof envelope !== 'string') throw new Error('Invalid router secret envelope');
  const parts = envelope.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1' || !parts.slice(1).every(part => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error('Invalid router secret envelope');
  const [iv, tag, data] = parts.slice(1).map(part => Buffer.from(part, 'base64url'));
  if (iv.length !== 12 || tag.length !== 16 || !data.length) throw new Error('Invalid router secret envelope');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
