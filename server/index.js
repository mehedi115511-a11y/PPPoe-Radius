import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { renderRouterOsPeerScript } from "./vpn-config.js";
import { revalidateSession } from "./security/session-revalidation.js";
import { tenantScope, resolveTenantPackage } from "./security/tenant-queries.js";
import { postRecharge, quoteRecharge, reconcileRechargeReceipt } from "./recharge/recharge-store.js";
import {createFundingRequest,reviewFundingRequest} from "./wallet/funding-evidence.js";
import {registerIpPoolRoutes} from "./ip-pools-routes.js";
import { registerRouterRoutes } from "./routers/routes.js";
import { createChrPeerSync } from "./chr-peer-sync.js";
import { routerOsRestAdapterFromEnv } from "./routeros-rest-adapter.js";
import { applyPeerOperation, reconcilePeers, revokeL2tpProfile } from "./vpn-peer-service.js";
import { createVpnProfile, vpnRuntimeConfig } from "./vpn-profile-create.js";
import { vpnReadiness } from "./vpn-readiness.js";

const { Pool } = pg;
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.API_PORT || 3001);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32)
  throw new Error("JWT_SECRET must contain at least 32 characters");

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || false }));
app.use(express.json({ limit: "256kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
const signToken = (payload) =>
  jwt.sign(payload, jwtSecret, { expiresIn: "30m", issuer: "pppoe-radius" });
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const claims = jwt.verify(token, jwtSecret, { issuer: "pppoe-radius" });
    req.auth = await revalidateSession(pool, claims);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
};
registerRouterRoutes(app, pool, authenticate);
registerIpPoolRoutes(app, pool, authenticate);

const requireAdmin = (req, res, next) =>
  req.auth?.role === "Admin" && !req.auth?.impersonatedBy
    ? next()
    : res.status(403).json({ error: "Administrator access required" });

let chrSync;
const configuredChrSync = () => {
  if (!vpnReadiness().chrSync.ready)
    throw Object.assign(new Error("CHR synchronization is not configured; check VPN readiness"), { status: 503 });
  if (!chrSync) chrSync = createChrPeerSync(routerOsRestAdapterFromEnv());
  return chrSync;
};
const peerOperation = (operation) => async (req,res,next) => {
  try {
    const data=await applyPeerOperation(pool,configuredChrSync(),{
      peerId:Number(req.params.id),actorId:req.auth.id,ownerId:req.auth.id,operation,
    });
    res.json({data});
  } catch(error) { next(error); }
};

app.post("/api/auth/login", loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const { rows } = await pool.query(
      "select id,name,username,password_hash,role,status from app_users where username=$1",
      [username],
    );
    const user = rows[0];
    if (
      !user ||
      user.status !== "Active" ||
      !(await bcrypt.compare(password || "", user.password_hash))
    )
      return res.status(401).json({ error: "Invalid credentials" });
    await pool.query("update app_users set last_login_at=now() where id=$1", [
      user.id,
    ]);
    const profile = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    };
    res.json({ token: signToken(profile), user: profile });
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/admin/resellers",
  authenticate,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        "select id,name,username,role,status,last_login_at from app_users where role in ('Reseller','Sub-reseller') order by role,name",
      );
      res.json({ data: rows });
    } catch (error) {
      next(error);
    }
  },
);

app.post("/api/admin/resellers", authenticate, requireAdmin, async (req, res, next) => {
  const name = String(req.body?.name || "").trim();
  const username = String(req.body?.username || "").trim();
  const password = req.body?.password;
  if (!name || name.length > 120 || !/^[A-Za-z_][A-Za-z0-9_.-]{2,62}$/.test(username) ||
      typeof password !== "string" || password.length < 12 || password.length > 256)
    return res.status(422).json({ error: "Valid name, username and password (12-256 characters) required" });
  let db;
  try {
    const hash = await bcrypt.hash(password, 12);
    db = await pool.connect();
    await db.query("BEGIN");
    const user = await db.query(
      "insert into app_users(name,username,password_hash,role,parent_user_id) values($1,$2,$3,'Reseller',$4) returning id,name,username,role,status",
      [name,username,hash,req.auth.id],
    );
    const id = user.rows[0].id;
    await db.query(
      "insert into wallet_accounts(tenant_owner_user_id,owner_user_id) values($1,$1),($1,$2)",
      [id,req.auth.id],
    );
    await db.query("COMMIT");
    res.status(201).json({ data: user.rows[0] });
  } catch (error) {
    if (db) await db.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ error: "Username already exists" });
    next(error);
  } finally {
    db?.release();
  }
});

app.get("/api/resellers/sub-resellers", authenticate, async (req, res, next) => {
  if(req.auth.role!=="Reseller" || req.auth.impersonatedBy)
    return res.status(403).json({error:"Active reseller access required"});
  try {
    const {rows}=await pool.query(
      "select id,name,username,role,status,last_login_at from app_users where role='Sub-reseller' and parent_user_id=$1 order by name,id",
      [req.auth.id],
    );
    res.json({data:rows});
  }catch(error){next(error)}
});

app.post("/api/resellers/sub-resellers", authenticate, async (req, res, next) => {
  if (req.auth.role !== "Reseller" || req.auth.impersonatedBy)
    return res.status(403).json({ error: "Active reseller access required" });
  const name = String(req.body?.name || "").trim();
  const username = String(req.body?.username || "").trim();
  const password = req.body?.password;
  if (!name || name.length > 120 || !/^[A-Za-z_][A-Za-z0-9_.-]{2,62}$/.test(username) ||
      typeof password !== "string" || password.length < 12 || password.length > 256)
    return res.status(422).json({ error: "Valid name, username and password (12-256 characters) required" });
  const settlementId = Number(process.env.BILLING_WALLET_OWNER_USER_ID);
  if (!Number.isSafeInteger(settlementId) || settlementId <= 0 || settlementId === Number(req.auth.id))
    return res.status(503).json({ error: "Settlement owner is not configured" });
  let db;
  try {
    const hash = await bcrypt.hash(password, 12);
    db = await pool.connect();
    await db.query("BEGIN");
    const owner = await db.query("select id from app_users where id=$1 and role='Admin' and status='Active'",[settlementId]);
    if (!owner.rows[0]) throw Object.assign(new Error("Active settlement owner is not configured"),{status:503});
    const user = await db.query(
      "insert into app_users(name,username,password_hash,role,parent_user_id) values($1,$2,$3,'Sub-reseller',$4) returning id,name,username,role,status",
      [name,username,hash,req.auth.id],
    );
    const id = user.rows[0].id;
    await db.query(
      "insert into wallet_accounts(tenant_owner_user_id,owner_user_id) values($1,$1),($1,$2)",
      [id,settlementId],
    );
    await db.query("COMMIT");
    res.status(201).json({ data:user.rows[0] });
  } catch(error) {
    if(db) await db.query("ROLLBACK").catch(()=>{});
    if(error.code==="23505") return res.status(409).json({error:"Username already exists"});
    next(error);
  } finally { db?.release(); }
});

app.post(
  "/api/admin/impersonate/:id",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        "select id,name,username,role,status from app_users where id=$1 and role in ('Reseller','Sub-reseller')",
        [req.params.id],
      );
      const target = rows[0];
      if (!target || target.status !== "Active")
        return res.status(404).json({ error: "Active reseller not found" });
      await pool.query(
        "insert into app_impersonation_audit(admin_user_id,target_user_id,ip_address,user_agent) values($1,$2,$3,$4)",
        [req.auth.id, target.id, req.ip, req.get("user-agent") || null],
      );
      const session = {
        id: target.id,
        name: target.name,
        username: target.username,
        role: target.role,
        impersonatedBy: {
          id: req.auth.id,
          name: req.auth.name,
          username: req.auth.username,
        },
      };
      res.json({ token: signToken(session), user: session });
    } catch (error) {
      next(error);
    }
  },
);

app.post("/api/auth/exit-impersonation", authenticate, (req, res) => {
  if (!req.auth.impersonatedBy)
    return res.status(400).json({ error: "Not an impersonated session" });
  const admin = req.auth.impersonatedBy;
  res.json({
    token: signToken({
      id: admin.id,
      name: admin.name,
      username: admin.username,
      role: "Admin",
    }),
    role: "Admin",
  });
});

app.get("/api/health", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("select now() server_time");
    res.json({ status: "ok", database: "ok", serverTime: rows[0].server_time });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", authenticate, async (req, res, next) => {
  try {
    const role = req.auth.role;
    const scope = tenantScope(req.auth);
    const { rows } = await pool.query(
      `select count(*)::int total,
      count(*) filter(where status='Online')::int online,
      count(*) filter(where status='Offline')::int offline,
      count(*) filter(where status='Expired')::int expired
      from app_clients where ${scope.sql}`,
      scope.params,
    );
    res.json({ role, ...rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/clients", authenticate, async (req, res, next) => {
  try {
    const status = req.query.status || "All";
    const search = `%${req.query.search || ""}%`;
    const scope = tenantScope(req.auth, '', 3);
    const { rows } = await pool.query(
      `select id,name,username "user",phone,package_name "package",package_id "packageId",
      router_name router,ip_address ip,expires_at "expiresAt",to_char(expires_at,'DD Mon YYYY') expiry,
      monthly_bill bill,status from app_clients
      where ($1='All' or status=$1) and (name ilike $2 or username ilike $2 or phone ilike $2)
      and ${scope.sql}
      order by id`,
      [status, search, ...scope.params],
    );
    res.json({ data: rows, count: rows.length });
  } catch (error) {
    next(error);
  }
});

const parseClient = (body) => {
  const data = {
    name: String(body.name || "").trim(),
    username: String(body.username || "").trim(),
    phone: String(body.phone || "").trim(),
    packageName: String(body.package || "").trim(),
    packageId: body.packageId,
    routerName: String(body.router || "").trim(),
    ipAddress: body.ip || null,
    expiresAt: body.expiresAt,
    monthlyBill: Number(body.monthlyBill),
    status: body.status || "Offline",
    password: String(body.password || ""),
    simultaneousUse: Number(body.simultaneousUse || 1),
  };
  if (
    !data.name ||
    !data.username ||
    !data.phone ||
    !/^[1-9][0-9]*$/.test(String(data.packageId)) ||
    !Number.isSafeInteger(Number(data.packageId)) ||
    !data.routerName ||
    !data.expiresAt ||
    !Number.isFinite(data.monthlyBill) ||
    data.monthlyBill < 0
  )
    throw Object.assign(new Error("Required client fields are invalid"), {
      status: 422,
    });
  if (!["Online", "Offline", "Expired"].includes(data.status))
    throw Object.assign(new Error("Invalid client status"), { status: 422 });
  if (
    !Number.isInteger(data.simultaneousUse) ||
    data.simultaneousUse < 1 ||
    data.simultaneousUse > 10
  )
    throw Object.assign(
      new Error("Simultaneous sessions must be between 1 and 10"),
      { status: 422 },
    );
  return data;
};
const returnedClient =
  'id,name,username "user",phone,package_name "package",package_id "packageId",router_name router,ip_address ip,expires_at "expiresAt",to_char(expires_at,\'DD Mon YYYY\') expiry,monthly_bill bill,status';

const syncRadiusUser = async (db, data, selectedPackage, previousUsername = null) => {
  if (!selectedPackage || Number(selectedPackage.id) !== Number(data.packageId) || Number(selectedPackage.owner_user_id) !== Number(data.ownerUserId))
    throw Object.assign(new Error('Exact tenant package required'), { status: 422 });
  const oldUsername = previousUsername || data.username;
  await db.query("delete from radcheck where username=$1", [oldUsername]);
  await db.query("delete from radreply where username=$1", [oldUsername]);
  await db.query("delete from radusergroup where username=$1", [oldUsername]);
  const speed = selectedPackage;
  const expiry = await db.query(
    "select to_char($1::date,'DD Mon YYYY 23:59:59') value",
    [data.expiresAt],
  );
  await db.query(
    "insert into radcheck(username,attribute,op,value) values($1,'Cleartext-Password',':=',$2),($1,'Simultaneous-Use',':=',$3),($1,'Expiration',':=',$4)",
    [
      data.username,
      data.password,
      String(data.simultaneousUse),
      expiry.rows[0].value,
    ],
  );
  await db.query(
    "insert into radreply(username,attribute,op,value) values($1,'Mikrotik-Rate-Limit',':=',$2)",
    [
      data.username,
      String(speed.upload_mbps) + "M/" + String(speed.download_mbps) + "M",
    ],
  );
  if (data.ipAddress)
    await db.query(
      "insert into radreply(username,attribute,op,value) values($1,'Framed-IP-Address',':=',$2)",
      [data.username, data.ipAddress],
    );
};

app.post("/api/clients", authenticate, async (req, res, next) => {
  const db = await pool.connect();
  try {
    const d = parseClient(req.body);
    if (d.password.length < 6)
      return res
        .status(422)
        .json({ error: "PPPoE password must contain at least 6 characters" });
    const owner = req.auth.role;
    if (req.body.ownerRole && req.body.ownerRole !== owner)
      return res.status(403).json({ error: "Explicit owner mapping required" });
    if (!["Admin", "Reseller", "Sub-reseller"].includes(owner))
      return res.status(422).json({ error: "Invalid owner role" });
    const selectedPackage = await resolveTenantPackage(db, req.auth, d.packageId);
    if (!selectedPackage || Number(selectedPackage.owner_user_id) !== Number(req.auth.id))
      return res.status(422).json({ error: "Exact owned package ID required" });
    d.packageName = selectedPackage.name;
    d.ownerUserId = req.auth.id;
    const sql =
      "insert into app_clients(name,username,phone,package_name,router_name,ip_address,expires_at,monthly_bill,status,owner_role,owner_user_id,package_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning " +
      returnedClient;
    await db.query("begin");
    const { rows } = await db.query(sql, [
      d.name,
      d.username,
      d.phone,
      d.packageName,
      d.routerName,
      d.ipAddress,
      d.expiresAt,
      d.monthlyBill,
      d.status,
      owner,
      req.auth.id,
      Number(d.packageId),
    ]);
    await syncRadiusUser(db, d, selectedPackage);
    await db.query(
      "insert into app_client_history(client_id,action,snapshot,actor_user_id) values($1,'Created',$2,$3)",
      [rows[0].id, rows[0], req.auth.id],
    );
    await db.query("commit");
    res.status(201).json({ data: rows[0] });
  } catch (error) {
    await db.query("rollback");
    if (error.code === "23505")
      return res.status(409).json({ error: "Username already exists" });
    next(error);
  } finally {
    db.release();
  }
});

app.patch("/api/clients/:id", authenticate, async (req, res, next) => {
  const db = await pool.connect();
  try {
    const d = parseClient(req.body);
    const scope = tenantScope(req.auth, "", 2);
    await db.query("begin");
    const { rows: old } = await db.query(
      `select * from app_clients where id=$1 and ${scope.sql} for update`,
      [req.params.id, ...scope.params],
    );
    if (!old[0]) {
      await db.query("rollback");
      return res.status(404).json({ error: "Client not found" });
    }
    const selectedPackage = await resolveTenantPackage(db, req.auth, d.packageId);
    if (!selectedPackage || Number(selectedPackage.owner_user_id) !== Number(old[0].owner_user_id)) {
      await db.query("rollback");
      return res.status(422).json({ error: "Exact client-owner package ID required" });
    }
    d.packageName = selectedPackage.name;
    d.ownerUserId = old[0].owner_user_id;
    if (!d.password) {
      const secret = await db.query(
        "select value from radcheck where username=$1 and attribute='Cleartext-Password' limit 1",
        [old[0].username],
      );
      d.password = secret.rows[0]?.value || "";
    }
    if (d.password.length < 6)
      throw Object.assign(
        new Error("PPPoE password must contain at least 6 characters"),
        { status: 422 },
      );
    await db.query(
      "insert into app_client_history(client_id,action,snapshot,actor_user_id) values($1,'Updated',$2,$3)",
      [req.params.id, old[0], req.auth.id],
    );
    const sql =
      "update app_clients set name=$1,username=$2,phone=$3,package_name=$4,router_name=$5,ip_address=$6,expires_at=$7,monthly_bill=$8,status=$9,package_id=$11 where id=$10 returning " +
      returnedClient;
    const { rows } = await db.query(sql, [
      d.name,
      d.username,
      d.phone,
      d.packageName,
      d.routerName,
      d.ipAddress,
      d.expiresAt,
      d.monthlyBill,
      d.status,
      req.params.id,
      Number(d.packageId),
    ]);
    await syncRadiusUser(db, d, selectedPackage, old[0].username);
    await db.query("commit");
    res.json({ data: rows[0] });
  } catch (error) {
    await db.query("rollback");
    if (error.code === "23505")
      return res.status(409).json({ error: "Username already exists" });
    next(error);
  } finally {
    db.release();
  }
});

app.delete("/api/clients/:id", authenticate, async (req, res, next) => {
  const db = await pool.connect();
  try {
    const scope = tenantScope(req.auth, "", 2);
    await db.query("begin");
    const { rows } = await db.query(
      `delete from app_clients where id=$1 and ${scope.sql} returning *`,
      [req.params.id, ...scope.params],
    );
    if (!rows[0]) {
      await db.query("rollback");
      return res.status(404).json({ error: "Client not found" });
    }
    await db.query(
      "insert into app_client_history(client_id,action,snapshot,actor_user_id) values($1,'Deleted',$2,$3)",
      [req.params.id, rows[0], req.auth.id],
    );
    await db.query("delete from radcheck where username=$1", [
      rows[0].username,
    ]);
    await db.query("delete from radreply where username=$1", [
      rows[0].username,
    ]);
    await db.query("delete from radusergroup where username=$1", [
      rows[0].username,
    ]);
    await db.query("commit");
    res.status(204).end();
  } catch (error) {
    await db.query("rollback");
    next(error);
  } finally {
    db.release();
  }
});

const parsePackage = (body) => {
  const data = {
    name: String(body.name || "").trim(),
    downloadMbps: Number(body.downloadMbps),
    uploadMbps: Number(body.uploadMbps),
    price: Number(body.price),
    validityDays: Number(body.validityDays || 30),
    status: body.status || "Active",
  };
  if (
    !data.name ||
    ![data.downloadMbps, data.uploadMbps, data.validityDays].every(
      Number.isInteger,
    ) ||
    data.downloadMbps < 1 ||
    data.uploadMbps < 1 ||
    data.validityDays < 1 ||
    !Number.isFinite(data.price) ||
    data.price < 0
  )
    throw Object.assign(new Error("Package fields are invalid"), {
      status: 422,
    });
  if (!["Active", "Disabled"].includes(data.status))
    throw Object.assign(new Error("Invalid package status"), { status: 422 });
  return data;
};

app.get("/api/packages", authenticate, async (req, res, next) => {
  try {
    const scope = tenantScope(req.auth);
    const { rows } = await pool.query(
      `select id,name,download_mbps "downloadMbps",upload_mbps "uploadMbps",price,validity_days "validityDays",status,owner_role "ownerRole" from app_packages where ${scope.sql} order by download_mbps,price`,
      scope.params,
    );
    res.json({ data: rows, count: rows.length });
  } catch (error) {
    next(error);
  }
});

app.post("/api/packages", authenticate, async (req, res, next) => {
  try {
    const d = parsePackage(req.body);
    const owner = req.auth.role;
    if (req.body.ownerRole && req.body.ownerRole !== owner)
      return res.status(403).json({ error: "Explicit owner mapping required" });
    const { rows } = await pool.query(
      'insert into app_packages(name,download_mbps,upload_mbps,price,validity_days,owner_role,status,owner_user_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,name,download_mbps "downloadMbps",upload_mbps "uploadMbps",price,validity_days "validityDays",status,owner_role "ownerRole"',
      [
        d.name,
        d.downloadMbps,
        d.uploadMbps,
        d.price,
        d.validityDays,
        owner,
        d.status,
        req.auth.id,
      ],
    );
    res.status(201).json({ data: rows[0] });
  } catch (error) {
    if (error.code === "23505")
      return res.status(409).json({ error: "Package already exists" });
    next(error);
  }
});

app.patch("/api/packages/:id", authenticate, async (req, res, next) => {
  try {
    const d = parsePackage(req.body);
    const scope = tenantScope(req.auth, "", 8);
    const { rows } = await pool.query(
      `update app_packages set name=$1,download_mbps=$2,upload_mbps=$3,price=$4,validity_days=$5,status=$6 where id=$7 and ${scope.sql} returning id,name,download_mbps "downloadMbps",upload_mbps "uploadMbps",price,validity_days "validityDays",status,owner_role "ownerRole"`,
      [
        d.name,
        d.downloadMbps,
        d.uploadMbps,
        d.price,
        d.validityDays,
        d.status,
        req.params.id,
        ...scope.params,
      ],
    );
    if (!rows[0]) return res.status(404).json({ error: "Package not found" });
    res.json({ data: rows[0] });
  } catch (error) {
    if (error.code === "23505")
      return res.status(409).json({ error: "Package already exists" });
    next(error);
  }
});

app.delete("/api/packages/:id", authenticate, async (req, res, next) => {
  try {
    const scope = tenantScope(req.auth, "", 2);
    const { rows } = await pool.query(
      `delete from app_packages where id=$1 and ${scope.sql} returning id`,
      [req.params.id, ...scope.params],
    );
    if (!rows[0]) return res.status(404).json({ error: "Package not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/wallet/funding-requests", authenticate, async (req,res,next) => {
  try{
    const {rows}=await pool.query(`select f.id,f.provider,f.external_reference "externalReference",
      f.amount_minor::text "amountMinor",f.created_at "createdAt",
      r.decision,r.note,r.created_at "reviewedAt"
      from wallet_funding_requests f left join wallet_funding_reviews r on r.request_id=f.id
      where f.tenant_owner_user_id=$1 order by f.created_at desc,f.id desc limit 200`,[req.auth.id]);
    res.set("Cache-Control","no-store").json({data:rows,count:rows.length});
  }catch(error){next(error)}
});
app.post("/api/wallet/funding-requests", authenticate, async (req,res,next) => {
  try{
    const key=req.get("Idempotency-Key");
    if(!key)return res.status(422).json({error:"Idempotency-Key header required"});
    const data=await createFundingRequest(pool,{
      actor:req.auth,provider:req.body?.provider,externalReference:req.body?.externalReference,
      amount:req.body?.amount,idempotencyKey:key,
    });
    res.status(data.replay?200:201).json({data});
  }catch(error){next(error)}
});
app.get("/api/admin/wallet/funding-requests", authenticate, requireAdmin, async (_req,res,next) => {
  try{
    const {rows}=await pool.query(`select f.id,f.tenant_owner_user_id "tenantOwnerUserId",
      f.provider,f.external_reference "externalReference",f.amount_minor::text "amountMinor",
      f.created_at "createdAt",r.decision,r.note,r.created_at "reviewedAt"
      from wallet_funding_requests f left join wallet_funding_reviews r on r.request_id=f.id
      order by f.created_at desc,f.id desc limit 200`);
    res.set("Cache-Control","no-store").json({data:rows,count:rows.length});
  }catch(error){next(error)}
});
app.post("/api/admin/wallet/funding-requests/:id/review", authenticate, requireAdmin, async (req,res,next) => {
  try{
    const data=await reviewFundingRequest(pool,{
      actor:req.auth,requestId:req.params.id,decision:req.body?.decision,note:req.body?.note,
    });
    res.status(data.replay?200:201).json({data});
  }catch(error){next(error)}
});
app.get("/api/wallet", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'select id,currency,balance_minor "balanceMinor",version,updated_at "updatedAt" from wallet_accounts where tenant_owner_user_id=$1 and owner_user_id=$1',
      [req.auth.id]);
    if (!rows[0]) return res.status(404).json({ error: "Owned wallet not found" });
    res.json({ data: rows[0] });
  } catch (error) { next(error); }
});
app.get("/api/wallet/ledger", authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const { rows } = await pool.query(
      `select t.id,t.operation,t.source_reference "sourceReference",t.created_at "createdAt",
       e.direction,e.amount_minor "amountMinor",e.wallet_account_id "walletAccountId"
       from wallet_ledger_transactions t join wallet_ledger_entries e on e.transaction_id=t.id
       join wallet_accounts a on a.id=e.wallet_account_id
       where t.tenant_owner_user_id=$1 and a.tenant_owner_user_id=$1 and a.owner_user_id=$1
       order by t.created_at desc,t.id desc,e.id limit $2`, [req.auth.id, limit]);
    res.json({ data: rows, count: rows.length });
  } catch (error) { next(error); }
});
app.get("/api/recharges", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select id,receipt_reference "receiptReference",client_id "clientId",package_id "packageId",
       recharge_mode mode,selected_days "selectedDays",recharge_date "rechargeDate",
       calculated_amount_minor "amountMinor",previous_expiry "previousExpiry",new_expiry "newExpiry",
       wallet_ledger_transaction_id "walletTransactionId",created_at "createdAt"
       from app_recharge_receipts where tenant_owner_user_id=$1 order by created_at desc,id desc limit 200`,
      [req.auth.id]);
    res.json({ data: rows, count: rows.length });
  } catch (error) { next(error); }
});
app.get("/api/recharges/:id", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select id,receipt_reference "receiptReference",client_id "clientId",package_id "packageId",
       recharge_mode mode,selected_days "selectedDays",recharge_date "rechargeDate",
       calculated_amount_minor "amountMinor",previous_expiry "previousExpiry",new_expiry "newExpiry",
       wallet_ledger_transaction_id "walletTransactionId",created_at "createdAt"
       from app_recharge_receipts where id=$1 and tenant_owner_user_id=$2`,
      [req.params.id, req.auth.id]);
    if (!rows[0]) return res.status(404).json({ error: "Receipt not found" });
    res.json({ data: rows[0] });
  } catch (error) { next(error); }
});
app.get("/api/recharges/:id/reconciliation", authenticate, async (req,res,next) => {
  try {
    const data=await reconcileRechargeReceipt(pool,{actor:req.auth,receiptId:req.params.id});
    res.set("Cache-Control","no-store").json({data});
  }catch(error){next(error)}
});
app.get("/api/clients/:id/recharge-quote", authenticate, async (req,res,next) => {
  try {
    const data = await quoteRecharge(pool, {
      actor:req.auth,clientId:req.params.id,mode:req.query.mode,selectedDays:req.query.selectedDays,
    });
    res.set("Cache-Control","no-store").json({ data });
  } catch(error) { next(error); }
});
app.post("/api/clients/:id/recharge", authenticate, async (req, res, next) => {
  try {
    const idempotencyKey = req.get("Idempotency-Key");
    if (!idempotencyKey) return res.status(422).json({ error: "Idempotency-Key header required" });
    const data = await postRecharge(pool, {
      actor: req.auth, clientId: Number(req.params.id), mode: req.body?.mode,
      selectedDays: req.body?.selectedDays, rechargeDate: req.body?.rechargeDate,
      expectedAmountMinor: req.body?.expectedAmountMinor,
      idempotencyKey, settlementOwnerUserId: Number(req.auth.role === "Admin"
        ? process.env.BILLING_ADMIN_SETTLEMENT_OWNER_USER_ID : process.env.BILLING_WALLET_OWNER_USER_ID),
    });
    res.status(data.replay ? 200 : 201).json({ data });
  } catch (error) { next(error); }
});

// Downloadable manual CHR peer command: public information only, not an activation.
app.get("/api/admin/vpn/peers/:id/routeros-script", authenticate, requireAdmin, async (req, res, next) => {
 if (!/^[1-9][0-9]*$/.test(req.params.id)) return res.status(422).json({ error: "Invalid peer ID" });
 try {
  const { rows } = await pool.query('select public_key "publicKey", host(tunnel_ip) "tunnelIp", status from vpn_peers where id=$1 and owner_user_id=$2',[req.params.id,req.auth.id]);
  if (!rows[0] || rows[0].status === "Revoked") return res.status(404).json({ error: "Available peer not found" });
  const script = renderRouterOsPeerScript(rows[0]);
  res.set("Cache-Control", "no-store");
  res.type("text/plain; charset=utf-8").send(`# Manual CHR-side peer command; NOT YET APPLIED\n${script}\n`);
 } catch (error) { next(error); }
});

app.get("/api/admin/vpn/readiness", authenticate, requireAdmin, (_req,res) => {
  res.set("Cache-Control","no-store").json({ data:vpnReadiness() });
});

app.get("/api/admin/vpn/chr-readback", authenticate, requireAdmin, async (_req,res,next) => {
  try {
    const peers=await configuredChrSync().list();
    res.set("Cache-Control","no-store").json({data:peers,count:peers.length});
  }catch(error){next(error)}
});

// Registry remains Pending until an independently verified CHR sync is available.
app.get("/api/admin/vpn/peers", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('select p.id,p.name,p.public_key "publicKey",host(p.tunnel_ip) "tunnelIp",p.status,p.routeros_major "routerOsMajor",p.protocol,p.vpn_username "vpnUsername",p.router_id "routerId",r.name "routerName",p.last_synced_at "lastSyncedAt",p.last_handshake_at "lastHandshakeAt",p.created_at "createdAt",p.revoked_at "revokedAt" from vpn_peers p left join app_routers r on r.id=p.router_id where p.owner_user_id=$1 order by p.id desc',[_req.auth.id]);
    res.json({ data: rows, count: rows.length });
  } catch (error) { next(error); }
});

app.post("/api/admin/vpn/peers", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const idempotencyKey=req.get("Idempotency-Key");
    if(!idempotencyKey) return res.status(422).json({error:"Idempotency-Key header required"});
    const data=await createVpnProfile(pool,{
      name:req.body?.name,routerOsMajor:req.body?.routerOsMajor,routerId:req.body?.routerId,
      actorId:req.auth.id,idempotencyKey,
    },vpnRuntimeConfig());
    res.set("Cache-Control","no-store");
    res.status(data.replay?200:201).json({data,message:data.replay?"VPN request replayed; the one-time script is not shown again.":"VPN created. Save the one-time script now."});
  } catch(error) { next(error); }
});

app.post("/api/admin/vpn/peers/reconcile", authenticate, requireAdmin, async (req,res,next) => {
  try {
    res.json({data:await reconcilePeers(pool,configuredChrSync(),req.auth.id)});
  } catch(error) { next(error); }
});
app.post("/api/admin/vpn/peers/:id/sync", authenticate, requireAdmin, peerOperation("Enable"));
app.post("/api/admin/vpn/peers/:id/disable", authenticate, requireAdmin, peerOperation("Disable"));
app.post("/api/admin/vpn/peers/:id/revoke", authenticate, requireAdmin, async (req,res,next) => {
  if (!/^[1-9][0-9]*$/.test(req.params.id)) return res.status(422).json({ error:"Invalid VPN profile ID" });
  try {
    const { rows } = await pool.query("select protocol from vpn_peers where id=$1 and owner_user_id=$2", [req.params.id,req.auth.id]);
    if (!rows.length) return res.status(404).json({ error: "VPN profile not found" });
    const data = rows[0].protocol === "l2tp_ipsec"
      ? await revokeL2tpProfile(pool, { peerId:req.params.id, actorId:req.auth.id, ownerId:req.auth.id })
      : await applyPeerOperation(pool, configuredChrSync(), { peerId:req.params.id, actorId:req.auth.id, ownerId:req.auth.id, operation:"Revoke" });
    res.json({ data });
  } catch(error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res
    .status(error.status || 500)
    .json({ error: error.status ? error.message : "Internal server error" });
});
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`PPPoE API listening on ${port}`),
);
const shutdown = () =>
  server.close(() => pool.end().finally(() => process.exit(0)));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
