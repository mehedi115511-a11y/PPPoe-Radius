import {describe,expect,it,vi} from 'vitest';
import {cidrUsableRange,usableRangeToCidr,encodeSentence} from './ip-pools-routeros.js';
describe('RouterOS IP pool protocol',()=>{
 it('encodes RouterOS sentences',()=>expect([...encodeSentence(['/ip/pool/print'])].slice(-1)).toEqual([0]));
 it('calculates exact usable IPv4 range without floating point',()=>{
  expect(cidrUsableRange('10.20.0.0/24')).toBe('10.20.0.1-10.20.0.254');
  expect(cidrUsableRange('192.0.2.0/30')).toBe('192.0.2.1-192.0.2.2');
  expect(usableRangeToCidr('10.20.0.1-10.20.0.254')).toBe('10.20.0.0/24');
 });
});
