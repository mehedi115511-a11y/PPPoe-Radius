import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const pool=new pg.Pool();
const users=[
  ['System Administrator','admin',process.env.ADMIN_BOOTSTRAP_PASSWORD,'Admin',null],
  ['Saifan Distribution','saifan-reseller',process.env.RESELLER_BOOTSTRAP_PASSWORD,'Reseller','admin'],
  ['Gazipur Zone','gazipur-zone',process.env.SUBRESELLER_BOOTSTRAP_PASSWORD,'Sub-reseller','saifan-reseller']
];
for(const [name,username,password,role,parentUsername] of users){
  if(!password)throw new Error(`Missing bootstrap password for ${username}`);
  const hash=await bcrypt.hash(password,12);
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    const parent=parentUsername?await db.query('select id from app_users where username=$1',[parentUsername]):{rows:[]};
    if(parentUsername&&!parent.rows[0])throw new Error(`Missing parent for ${username}`);
    const result=await db.query(`insert into app_users(name,username,password_hash,role,parent_user_id)
      values($1,$2,$3,$4,$5) on conflict(username) do update
      set name=excluded.name,role=excluded.role,parent_user_id=excluded.parent_user_id
      returning id`,[name,username,hash,role,parent.rows[0]?.id||null]);
    const ownerId=result.rows[0].id;
    await db.query(`insert into wallet_accounts(tenant_owner_user_id,owner_user_id)
      values($1,$1) on conflict(tenant_owner_user_id,owner_user_id,currency) do nothing`,[ownerId]);
    if(role!=='Admin'){
      const admin=await db.query("select id from app_users where username=$1 and role='Admin'",[users[0][1]]);
      if(!admin.rows[0])throw new Error('Bootstrap administrator missing');
      await db.query(`insert into wallet_accounts(tenant_owner_user_id,owner_user_id)
        values($1,$2) on conflict(tenant_owner_user_id,owner_user_id,currency) do nothing`,
        [ownerId,admin.rows[0].id]);
    }
    await db.query('COMMIT');
  }catch(error){
    await db.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{db.release()}
}
await pool.end();
console.log('Bootstrap users ready');
