import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pg from 'pg';

const {Pool}=pg;
const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const port=Number(process.env.API_PORT||3001);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin:process.env.CORS_ORIGIN?.split(',')||false}));
app.use(express.json({limit:'256kb'}));

app.get('/api/health',async(_req,res,next)=>{
  try{const {rows}=await pool.query('select now() server_time');res.json({status:'ok',database:'ok',serverTime:rows[0].server_time});}catch(error){next(error);}
});

app.get('/api/dashboard',async(req,res,next)=>{
  try{
    const role=req.query.role||'Admin';
    const {rows}=await pool.query(`select count(*)::int total,
      count(*) filter(where status='Online')::int online,
      count(*) filter(where status='Offline')::int offline,
      count(*) filter(where status='Expired')::int expired
      from app_clients where ($1='Admin' or owner_role=$1)`,[role]);
    res.json({role,...rows[0]});
  }catch(error){next(error);}
});

app.get('/api/clients',async(req,res,next)=>{
  try{
    const status=req.query.status||'All';
    const search=`%${req.query.search||''}%`;
    const {rows}=await pool.query(`select id,name,username "user",phone,package_name "package",
      router_name router,ip_address ip,to_char(expires_at,'DD Mon YYYY') expiry,
      monthly_bill bill,status from app_clients
      where ($1='All' or status=$1) and (name ilike $2 or username ilike $2 or phone ilike $2)
      order by id`,[status,search]);
    res.json({data:rows,count:rows.length});
  }catch(error){next(error);}
});

app.use((error,_req,res,_next)=>{console.error(error);res.status(500).json({error:'Internal server error'});});
const server=app.listen(port,'127.0.0.1',()=>console.log(`PPPoE API listening on ${port}`));
const shutdown=()=>server.close(()=>pool.end().finally(()=>process.exit(0)));
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
