import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const {Pool}=pg;
const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const port=Number(process.env.API_PORT||3001);
const jwtSecret=process.env.JWT_SECRET;
if(!jwtSecret||jwtSecret.length<32)throw new Error('JWT_SECRET must contain at least 32 characters');

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin:process.env.CORS_ORIGIN?.split(',')||false}));
app.use(express.json({limit:'256kb'}));

const loginLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false});
const signToken=payload=>jwt.sign(payload,jwtSecret,{expiresIn:'30m',issuer:'pppoe-radius'});
const authenticate=(req,res,next)=>{
  const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');
  if(!token)return res.status(401).json({error:'Authentication required'});
  try{req.auth=jwt.verify(token,jwtSecret,{issuer:'pppoe-radius'});next();}
  catch{return res.status(401).json({error:'Invalid or expired session'});}
};
const requireAdmin=(req,res,next)=>req.auth?.role==='Admin'&&!req.auth?.impersonatedBy?next():res.status(403).json({error:'Administrator access required'});

app.post('/api/auth/login',loginLimiter,async(req,res,next)=>{
  try{
    const {username,password}=req.body||{};
    const {rows}=await pool.query('select id,name,username,password_hash,role,status from app_users where username=$1',[username]);
    const user=rows[0];
    if(!user||user.status!=='Active'||!await bcrypt.compare(password||'',user.password_hash))return res.status(401).json({error:'Invalid credentials'});
    await pool.query('update app_users set last_login_at=now() where id=$1',[user.id]);
    const profile={id:user.id,name:user.name,username:user.username,role:user.role};
    res.json({token:signToken(profile),user:profile});
  }catch(error){next(error);}
});

app.get('/api/admin/resellers',authenticate,requireAdmin,async(_req,res,next)=>{
  try{const {rows}=await pool.query("select id,name,username,role,status,last_login_at from app_users where role in ('Reseller','Sub-reseller') order by role,name");res.json({data:rows});}catch(error){next(error);}
});

app.post('/api/admin/impersonate/:id',authenticate,requireAdmin,async(req,res,next)=>{
  try{
    const {rows}=await pool.query("select id,name,username,role,status from app_users where id=$1 and role in ('Reseller','Sub-reseller')",[req.params.id]);
    const target=rows[0];
    if(!target||target.status!=='Active')return res.status(404).json({error:'Active reseller not found'});
    await pool.query('insert into app_impersonation_audit(admin_user_id,target_user_id,ip_address,user_agent) values($1,$2,$3,$4)',[req.auth.id,target.id,req.ip,req.get('user-agent')||null]);
    const session={id:target.id,name:target.name,username:target.username,role:target.role,impersonatedBy:{id:req.auth.id,name:req.auth.name,username:req.auth.username}};
    res.json({token:signToken(session),user:session});
  }catch(error){next(error);}
});

app.post('/api/auth/exit-impersonation',authenticate,(req,res)=>{
  if(!req.auth.impersonatedBy)return res.status(400).json({error:'Not an impersonated session'});
  const admin=req.auth.impersonatedBy;
  res.json({token:signToken({id:admin.id,name:admin.name,username:admin.username,role:'Admin'}),role:'Admin'});
});

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
