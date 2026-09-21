import {describe,it,expect,vi} from 'vitest';
import {encryptRouterSecret} from './secret-crypto.js';
import {checkRouterHealth} from './health.js';
const key='11'.repeat(32),actor={id:8,role:'Reseller',status:'Active'};
const envelope=encryptRouterSecret(JSON.stringify({username:'api-user',password:'api-password'}),{keyHex:key,ownerId:8,routerId:4,purpose:'router-api'});
describe('RouterOS health',()=>{
 it('uses encrypted credential, returns sanitized readback and audits success',async()=>{
  const db={query:vi.fn().mockResolvedValueOnce({rows:[{id:4,host:'router.example',port:443,routerOsVersion:'7',encryptedValue:envelope}]}).mockResolvedValueOnce({rows:[]})};
  const fetchImpl=vi.fn().mockResolvedValue({ok:true,json:async()=>({version:'7.20',uptime:'1d2h',secret:'never'})});
  const result=await checkRouterHealth(db,actor,'4',key,{fetchImpl});
  expect(result).toMatchObject({routerId:4,reachable:true,authenticated:true,version:'7.20',uptime:'1d2h'});
  expect(JSON.stringify(result)).not.toContain('api-password');
  expect(fetchImpl.mock.calls[0][1].headers.authorization).toMatch(/^Basic /);
  expect(db.query.mock.calls[1][0]).toContain('app_router_audit');
 });
 it('denies cross-tenant/missing router without network call',async()=>{const fetchImpl=vi.fn(),db={query:vi.fn().mockResolvedValue({rows:[]})};await expect(checkRouterHealth(db,actor,'4',key,{fetchImpl})).rejects.toMatchObject({status:404});expect(fetchImpl).not.toHaveBeenCalled()});
 it('requires server encryption key',async()=>{await expect(checkRouterHealth({query:vi.fn()},actor,'4','')).rejects.toMatchObject({status:503})});
});
