import {test,expect,vi} from 'vitest';
import {listRouters,createRouter,updateRouter,deleteRouter} from './catalog.js';
const actor={id:12,role:'Reseller',status:'Active'};
const input={name:'NAS One',host:'192.0.2.2',port:8729,routerOsVersion:'7',status:'Disabled'};
test('list binds exact owner and excludes deleted routers',async()=>{const db={query:vi.fn().mockResolvedValue({rows:[]})};expect(await listRouters(db,actor)).toEqual([]);expect(db.query.mock.calls[0][1]).toEqual([12])});
test('create stores validated router without credentials',async()=>{const db={query:vi.fn().mockResolvedValue({rows:[{id:4}]})};expect(await createRouter(db,actor,input)).toEqual({id:4})});
test('update requires exact owner',async()=>{const db={query:vi.fn().mockResolvedValue({rows:[]})};await expect(updateRouter(db,actor,'3',input)).rejects.toMatchObject({status:404})});
function deletionPool(dependency={id:3,clients:0,packages:0,unmappedClients:0,unmappedPackages:0}){
 const client={query:vi.fn(async(sql)=>sql.includes('SELECT r.id')?{rows:[dependency]}:{rows:[]}),release:vi.fn()};
 return {connect:vi.fn(async()=>client),client};
}
test('deletion is transactional, revokes secrets and writes audit',async()=>{const {connect,client}=deletionPool();await deleteRouter({connect},actor,'3');expect(client.query.mock.calls.map(x=>x[0])).toEqual(expect.arrayContaining(['BEGIN','COMMIT']));expect(client.query.mock.calls.some(x=>x[0].startsWith('DELETE FROM app_router_secrets'))).toBe(true);expect(client.query.mock.calls.some(x=>x[0].includes('app_router_audit'))).toBe(true);expect(client.release).toHaveBeenCalled()});
test('deletion fails closed for linked or unreconciled records',async()=>{const {connect,client}=deletionPool({id:3,clients:1,packages:0,unmappedClients:0,unmappedPackages:0});await expect(deleteRouter({connect},actor,'3')).rejects.toMatchObject({status:409});expect(client.query.mock.calls.some(x=>x[0].startsWith('UPDATE app_routers'))).toBe(false)});
test('cross tenant missing router cannot be deleted',async()=>{const {connect}=deletionPool(undefined);const client=await connect();client.query.mockImplementation(async sql=>sql.includes('SELECT r.id')?{rows:[]}:{rows:[]});await expect(deleteRouter({connect:async()=>client},actor,'4')).rejects.toMatchObject({status:404})});
test('suspended actor cannot access catalog',async()=>{const db={query:vi.fn()};await expect(listRouters(db,{...actor,status:'Suspended'})).rejects.toMatchObject({status:403})});
test('database uniqueness conflict produces safe error',async()=>{const db={query:vi.fn().mockRejectedValue({code:'23505'})};await expect(createRouter(db,actor,input)).rejects.toMatchObject({status:409})});
