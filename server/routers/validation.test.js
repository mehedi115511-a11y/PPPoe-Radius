import { describe, expect, it } from 'vitest';
import { validateRouterId, validateRouterInput, requireRouterOwner } from './validation.js';

const valid = { name: 'Core Router', host: '10.0.0.1', port: 8729, routerOsVersion: '7' };
describe('Router/NAS validation', () => {
  it('normalizes valid router input with safe default', () => {
    expect(validateRouterInput(valid)).toEqual({ ...valid, status: 'Disabled' });
    expect(validateRouterInput({ name: 'Site', host: 'nas.example.com' }).port).toBe(8729);
  });
  it.each([{}, { ...valid, host: 'http://internal' }, { ...valid, host: 'bad host' }, { ...valid, port: 0 }, { ...valid, port: 65536 }, { ...valid, port: '1.5' }, { ...valid, routerOsVersion: '5' }, { ...valid, status: 'Unknown' }, { ...valid, password: 'secret' }])('rejects malformed or credential-bearing input %#', (input) => {
    expect(() => validateRouterInput(input)).toThrow();
  });
  it('rejects malformed router IDs', () => {
    expect(validateRouterId('42')).toBe(42);
    for (const id of ['0', '-1', '1 OR 1=1', '9007199254740992', '01']) expect(() => validateRouterId(id)).toThrow();
  });
  it('fails closed for impersonated and suspended actors', () => {
    expect(requireRouterOwner({ id: 3, status: 'Active', role: 'Reseller' })).toBe(3);
    for (const actor of [null, { id: 3, status: 'Suspended', role: 'Admin' }, { id: 3, status: 'Active', role: 'Admin', impersonatedBy: 1 }, { id: 0, status: 'Active', role: 'Reseller' }]) {
      expect(() => requireRouterOwner(actor)).toThrow();
    }
  });
});
