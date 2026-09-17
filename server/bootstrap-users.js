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
  const parent=parentUsername?await pool.query('select id from app_users where username=$1',[parentUsername]):{rows:[]};
  await pool.query(`insert into app_users(name,username,password_hash,role,parent_user_id)
    values($1,$2,$3,$4,$5) on conflict(username) do update
    set name=excluded.name,role=excluded.role,parent_user_id=excluded.parent_user_id`,
    [name,username,hash,role,parent.rows[0]?.id||null]);
}
await pool.end();
console.log('Bootstrap users ready');
