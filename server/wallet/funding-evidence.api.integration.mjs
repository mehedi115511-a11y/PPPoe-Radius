import {spawn} from "node:child_process";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.includes("pppoe_funding_http_test_"))throw new Error("Isolated funding HTTP test database required");
const port=Number(process.env.TEST_API_PORT||39481),secret="funding-http-isolated-secret-32-characters-minimum",base="http://127.0.0.1:"+port;
const pool=new pg.Pool({connectionString:url});
const pass="isolated-funding-test-password",hash=await bcrypt.hash(pass,4);
let server,stderr="";
const api=(path,method="GET",token,body,key)=>fetch(base+path,{method,headers:{"content-type":"application/json",...(token?{authorization:"Bearer "+token}:{}),...(key?{"Idempotency-Key":key}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function status(promise,expected,label){const r=await promise;if(r.status!==expected)throw new Error(label+": expected "+expected+", got "+r.status+" "+await r.text());return r.json()}
async function login(username){const r=await status(api("/api/auth/login","POST",null,{username,password:pass}),200,"login");return r.token}
try{
 const result=await pool.query("insert into app_users(name,username,password_hash,role,status) values ('Funding admin','funding-http-admin',$1,'Admin','Active'),('Funding A','funding-http-a',$1,'Reseller','Active'),('Funding B','funding-http-b',$1,'Reseller','Active') returning id,username",[hash]);
 const ids=Object.fromEntries(result.rows.map(r=>[r.username,r.id]));
 server=spawn(process.execPath,["server/index.js"],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:url,API_PORT:String(port),JWT_SECRET:secret,CORS_ORIGIN:"http://127.0.0.1"},stdio:["ignore","pipe","pipe"]});
 server.stderr.on("data",chunk=>{stderr+=chunk.toString().slice(0,1000)});
 let ready=false;
 for(let i=0;i<70;i++){try{const r=await api("/api/auth/login","POST",null,{username:"missing",password:pass});if(r.status===401){ready=true;break}}catch{}await new Promise(ok=>setTimeout(ok,100))}
 if(!ready)throw new Error("API not ready: "+stderr.slice(0,300));
 const a=await login("funding-http-a"),b=await login("funding-http-b"),admin=await login("funding-http-admin");
 const body={provider:"bkash",externalReference:"FUNDHTTP001",amount:"500.00"};
 const first=(await status(api("/api/wallet/funding-requests","POST",a,body,"request-one"),201,"first evidence")).data;
 if(first.amountMinor!=="50000")throw new Error("amount");
 const replay=(await status(api("/api/wallet/funding-requests","POST",a,body,"request-one"),200,"replay")).data;
 if(!replay.replay||replay.id!==first.id)throw new Error("replay identity");
 await status(api("/api/wallet/funding-requests","POST",a,{...body,amount:"501.00"},"request-one"),409,"changed replay");
 await status(api("/api/wallet/funding-requests","POST",a,{...body,amount:"x"},"invalid-amount"),422,"invalid amount");
 await status(api("/api/wallet/funding-requests","POST",b,body,"request-two"),409,"duplicate external reference");
 const own=await status(api("/api/wallet/funding-requests","GET",a),200,"own list");
 const other=await status(api("/api/wallet/funding-requests","GET",b),200,"other list");
 if(own.count!==1||other.count!==0)throw new Error("tenant isolation");
 await status(api("/api/admin/wallet/funding-requests","GET",a),403,"admin listing denial");
 await status(api("/api/admin/wallet/funding-requests/"+first.id+"/review","POST",a,{decision:"evidence_ok",note:"Evidence examined"}),403,"review denial");
 const impersonated=jwt.sign({id:ids["funding-http-a"],username:"funding-http-a",role:"Reseller",impersonatedBy:{id:ids["funding-http-admin"],username:"funding-http-admin"}},secret,{issuer:"pppoe-radius",expiresIn:"5m"});
 await status(api("/api/wallet/funding-requests","POST",impersonated,{...body,externalReference:"FUNDHTTP002"},"impersonated-one"),403,"impersonated write");
 const review=(await status(api("/api/admin/wallet/funding-requests/"+first.id+"/review","POST",admin,{decision:"evidence_ok",note:"Evidence examined"}),201,"admin review")).data;
 if(review.decision!=="evidence_ok")throw new Error("review");
 const parallelBody={...body,externalReference:"FUNDHTTP004"};
 const concurrent=await Promise.all([
   api("/api/wallet/funding-requests","POST",a,parallelBody,"parallel-one"),
   api("/api/wallet/funding-requests","POST",a,parallelBody,"parallel-one")
 ]);
 if(concurrent.map(r=>r.status).sort().join(",")!=="200,201")throw new Error("Concurrent retry status "+concurrent.map(r=>r.status));
 const concurrentRows=await Promise.all(concurrent.map(r=>r.json()));
 if(concurrentRows[0].data.id!==concurrentRows[1].data.id)throw new Error("Concurrent retry created two records");
 const count=await pool.query("select count(*)::int n from wallet_funding_requests where tenant_owner_user_id=$1 and external_reference=$2",[ids["funding-http-a"],"FUNDHTTP004"]);
 if(count.rows[0].n!==1)throw new Error("Concurrent retry duplicate rows");
 await pool.query("update app_users set status='Suspended' where id=$1",[ids["funding-http-a"]]);
 await status(api("/api/wallet/funding-requests","POST",a,{...body,externalReference:"FUNDHTTP003"},"suspended-one"),401,"suspended token");
 const balances=await pool.query("select coalesce(sum(balance_minor),0)::text total from wallet_accounts");
 const entries=await pool.query("select count(*)::int n from wallet_ledger_entries");
 if(balances.rows[0].total!=="0"||entries.rows[0].n!==0)throw new Error("wallet changed");
 console.log("FUNDING_HTTP_PASS create=201 replay=200 changed=409 invalid=422 duplicate=409 concurrent_replay=1 tenant=isolated admin=guarded impersonated=403 suspended=401 wallet=0 ledger=0");
}finally{if(server&&server.exitCode===null){server.kill("SIGTERM");await new Promise(ok=>server.once("exit",ok))}await pool.end()}
