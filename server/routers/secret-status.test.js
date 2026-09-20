import { describe, it, expect, vi } from 'vitest';
import { getRouterSecretStatus } from './secret-status.js';
const actor={id:12,role:'Admin',status:'Active'};
describe('Router credential status privacy',()=>{
  it('returns metadata only, scoped to the requesting tenant',async()=>{
    const db={query:vi.fn().mockResolvedValue({rows:[{routerId:4,purpose:'router-api',keyVersion:2,updatedAt:'2026-09-21',encrypted_value:'do-not-expose'}]})};
    const result=await getRouterSecretStatus(db,actor,'4');
    expect(result).toEqual({routerId:4,credentials:[{purpose:'router-api',keyVersion:2,updatedAt:'2026-09-21'}]});
    expect(JSON.stringify(result)).not.toContain('do-not-expose');
    expect(db.query.mock.calls[0][1]).toEqual([4,12]);
  });
  it('returns 404 when the router is not owned or has been removed',async()=>{
    const db={query:vi.fn().mockResolvedValue({rows:[]})};
    await expect(getRouterSecretStatus(db,actor,'4')).rejects.toMatchObject({status:404});
  });
});
