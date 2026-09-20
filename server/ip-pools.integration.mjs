import pg from "pg";
import {listIpPools,saveIpPool,deleteIpPool,parseIpPool} from "./ip-pools.js";
const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.includes("pppoe_ip_pool_test_"))throw new Error("isolated IP pool database required");
const pool=new pg.Pool({connectionString:url});
const reject=async(task,status)=>{try{await task;throw new Error("Expected error "+status)}catch(e){if(e.status!==status)throw e}};
try{
 const users=await pool.query("insert into app_users(name,username,password_hash,role,status) values ('Pool A','pool-a','x','Reseller','Active'),('Pool B','pool-b','x','Reseller','Active') returning id");
 const a={id:users.rows[0].id,status:"Active",role:"Reseller"},b={id:users.rows[1].id,status:"Active",role:"Reseller"};
 const first=await saveIpPool(pool,a,{name:"Client IPv4",network:"10.20.0.0/24",status:"Active"});
 if(first.network!=="10.20.0.0/24")throw new Error("CIDR persisted");
 await reject(saveIpPool(pool,a,{name:"Overlap",network:"10.20.0.0/25"}),409);
 await reject(saveIpPool(pool,a,{name:"Host",network:"10.20.0.1/24"}),422);
 await reject(saveIpPool(pool,a,{name:"Invalid",network:"999.0.0.0/24"}),422);
 const other=await saveIpPool(pool,b,{name:"Client IPv4",network:"10.20.0.0/24"});
 if((await listIpPools(pool,a)).length!==1||(await listIpPools(pool,b)).length!==1)throw new Error("tenant list");
 await reject(saveIpPool(pool,b,{name:"Hijack",network:"10.30.0.0/24"},first.id),404);
 await reject(deleteIpPool(pool,b,first.id),404);
 const changed=await saveIpPool(pool,a,{name:"Expanded",network:"10.30.0.0/24",status:"Disabled"},first.id);
 if(changed.id!==first.id||changed.status!=="Disabled")throw new Error("update");
 await reject(saveIpPool(pool,{...a,status:"Suspended"},{name:"Denied",network:"10.40.0.0/24"}),403);
 await reject(saveIpPool(pool,{...a,impersonatedBy:{id:42}},{name:"Denied",network:"10.40.0.0/24"}),403);
 await deleteIpPool(pool,a,first.id);
 if((await listIpPools(pool,a)).length!==0||(await listIpPools(pool,b))[0].id!==other.id)throw new Error("delete scope");
 console.log("IP_POOLS_INTEGRATION_PASS create=1 overlap=409 invalid=422 tenant=isolated cross_tenant=404 suspended=403 impersonated=403 update=1 delete=1");
}finally{await pool.end()}
