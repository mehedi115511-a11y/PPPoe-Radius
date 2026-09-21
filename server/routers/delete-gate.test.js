import {describe,expect,it,vi} from 'vitest';
import {deleteRouter} from './catalog.js';
const actor={id:31,role:'Admin',status:'Active'};
const poolFor=rows=>{const client={query:vi.fn(async sql=>sql.includes('SELECT r.id')?{rows}:{rows:[]}),release:vi.fn()};return {pool:{connect:vi.fn(async()=>client)},client}};
describe('dependency-aware router removal',()=>{
 it('refuses linked records with 409 and rolls back',async()=>{const {pool,client}=poolFor([{id:9,clients:1,packages:0,unmappedClients:0,unmappedPackages:0}]);await expect(deleteRouter(pool,actor,'9')).rejects.toMatchObject({status:409});expect(client.query.mock.calls.some(x=>x[0]==='ROLLBACK')).toBe(true);expect(client.query.mock.calls.some(x=>x[0].startsWith('UPDATE app_routers'))).toBe(false)});
 it('does not disclose another tenant router',async()=>{const {pool}=poolFor([]);await expect(deleteRouter(pool,actor,'9')).rejects.toMatchObject({status:404})});
 it('rejects invalid IDs before database connect',async()=>{const pool={connect:vi.fn()};await expect(deleteRouter(pool,actor,'bad')).rejects.toMatchObject({status:422});expect(pool.connect).not.toHaveBeenCalled()});
});
