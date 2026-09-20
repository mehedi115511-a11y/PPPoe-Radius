import { describe, expect, it } from 'vitest';
import { encryptRouterSecret, decryptRouterSecret } from './secret-crypto.js';

const keyHex = 'a'.repeat(64);
const context = { keyHex, ownerId: 12, routerId: 44, purpose: 'router-api' };
describe('router secret crypto boundary', () => {
  it('encrypts without exposing the secret and decrypts for the same context', () => {
    const envelope = encryptRouterSecret('secret-for-router', context);
    expect(envelope.startsWith('v1:')).toBe(true);
    expect(envelope).not.toContain('secret-for-router');
    expect(decryptRouterSecret(envelope, context)).toBe('secret-for-router');
    expect(encryptRouterSecret('secret-for-router', context)).not.toBe(envelope);
  });
  it('rejects another owner, router, purpose, or encryption key', () => {
    const envelope = encryptRouterSecret('private', context);
    for (const change of [{ ownerId: 13 }, { routerId: 45 }, { purpose: 'radius-shared-secret' }, { keyHex: 'b'.repeat(64) }]) {
      expect(() => decryptRouterSecret(envelope, { ...context, ...change })).toThrow();
    }
  });
  it('rejects missing keys, malformed envelopes and modified authentication tags', () => {
    expect(() => encryptRouterSecret('private', { ...context, keyHex: '' })).toThrow(/key/i);
    expect(() => decryptRouterSecret('not-an-envelope', context)).toThrow(/envelope/i);
    const parts = encryptRouterSecret('private', context).split(':');
    parts[2] = Buffer.alloc(16).toString('base64url');
    expect(() => decryptRouterSecret(parts.join(':'), context)).toThrow();
    expect(() => encryptRouterSecret('', context)).toThrow();
  });
});
