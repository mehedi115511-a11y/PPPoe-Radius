import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { registerRouterRoutes } from './routes.js';
const actor={id:12,role:'Admin',status:'Active'};
const request=async(app,body,authorized=true)=>{
  const server=app.listen(0);
  try { const response=await fetch(`http://127.0.0.1:${server.address().port}/api/routers/4/secrets/router-api`,{method:'PUT',headers:{'Content-Type':'application/json', ...(authorized?{'Authorization':'Bearer test'}:{})},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  } finally {await new Promise(resolve=>server.close(resolve));}
};
function fixture(){const db={query:vi.fn().mockResolvedValue({rows:[{routerId:4,purpose:'router-api',keyVersion:1}]})};const app=express();app.use(express.json());
  registerRouterRoutes(app,db,(req,res,next)=>req.headers.authorization?(req.auth=actor,next()):res.status(401).json({error:'Authentication required'}));
  app.use((error,_req,res,_next)=>res.status(error.status||500).json({error:error.message}));return {app,db};}
describe('Router/NAS secret HTTP boundary',()=>{
 it('rejects anonymous writes without database access',async()=>{const {app,db}=fixture();const r=await request(app,{secret:'test-password-123'},false);expect(r.status).toBe(401);expect(db.query).not.toHaveBeenCalled();});
 it('rejects extra fields before database access',async()=>{const {app,db}=fixture();const r=await request(app,{secret:'test-password-123',password:'bad'});expect(r.status).toBe(422);expect(db.query).not.toHaveBeenCalled();});
 it('fails closed without server key and leaks no supplied secret',async()=>{const {app,db}=fixture();const old=process.env.ROUTER_SECRET_KEY_HEX;delete process.env.ROUTER_SECRET_KEY_HEX;
   try {const r=await request(app,{secret:'test-password-123'});expect(r.status).toBe(503);expect(JSON.stringify(r.data)).not.toContain('test-password-123');expect(db.query).not.toHaveBeenCalled();}finally{if(old===undefined)delete process.env.ROUTER_SECRET_KEY_HEX;else process.env.ROUTER_SECRET_KEY_HEX=old;}
 });
});
