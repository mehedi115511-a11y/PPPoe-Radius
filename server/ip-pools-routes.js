import {listIpPools,saveIpPool,deleteIpPool} from './ip-pools.js';
import {syncIpPool,readbackIpPool,removeRemoteIpPool,importIpPools,importRemoteIpPool,assignPoolClient} from './ip-pools-sync.js';
export function registerIpPoolRoutes(app,db,authenticate){const execute=(operation,status=200)=>async(req,res,next)=>{try{const data=await operation(req);res.set('Cache-Control','no-store');if(status===204)return res.status(204).end();res.status(status).json({data,...(Array.isArray(data)?{count:data.length}:{})})}catch(e){next(e)}};
 app.get('/api/ip-pools',authenticate,execute(req=>listIpPools(db,req.auth)));
 app.post('/api/ip-pools',authenticate,execute(req=>saveIpPool(db,req.auth,req.body),201));
 app.patch('/api/ip-pools/:id',authenticate,execute(req=>saveIpPool(db,req.auth,req.body,req.params.id)));
 app.delete('/api/ip-pools/:id',authenticate,execute(req=>deleteIpPool(db,req.auth,req.params.id),204));
 app.post('/api/ip-pools/:id/sync',authenticate,execute(req=>syncIpPool(db,req.auth,req.params.id,process.env.ROUTER_SECRET_KEY_HEX)));
 app.post('/api/ip-pools/:id/readback',authenticate,execute(req=>readbackIpPool(db,req.auth,req.params.id,process.env.ROUTER_SECRET_KEY_HEX)));
 app.post('/api/ip-pools/:id/remove-router',authenticate,execute(req=>removeRemoteIpPool(db,req.auth,req.params.id,process.env.ROUTER_SECRET_KEY_HEX)));
 app.post('/api/ip-pools/:id/clients',authenticate,execute(req=>assignPoolClient(db,req.auth,req.params.id,req.body?.clientId)));
 app.get('/api/routers/:id/ip-pools/import',authenticate,execute(req=>importIpPools(db,req.auth,req.params.id,process.env.ROUTER_SECRET_KEY_HEX)));
 app.post('/api/routers/:id/ip-pools/import',authenticate,execute(req=>importRemoteIpPool(db,req.auth,req.params.id,req.body?.remoteId,process.env.ROUTER_SECRET_KEY_HEX),201));
}
