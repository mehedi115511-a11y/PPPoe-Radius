import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { allocateVpnAddress, validateWireGuardPublicKey } from "./vpn-address.js";
import { renderRouterOsPeerScript } from "./vpn-config.js";
import { createChrPeerSync } from "./chr-peer-sync.js";
import { routerOsRestAdapterFromEnv } from "./routeros-rest-adapter.js";
import { applyPeerOperation } from "./vpn-peer-service.js";

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
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.auth = jwt.verify(token, jwtSecret, { issuer: "pppoe-radius" });
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
};
const requireAdmin = (req, res, next) =>
  req.auth?.role === "Admin" && !req.auth?.impersonatedBy
    ? next()
    : res.status(403).json({ error: "Administrator access required" });

let chrSync;
const configuredChrSync = () => {
  if (!process.env.CHR_ROUTEROS_REST_URL)
    throw Object.assign(new Error("CHR synchronization is not configured"), { status: 503 });
  if (!chrSync) chrSync = createChrPeerSync(routerOsRestAdapterFromEnv());
  return chrSync;
};
const peerOperation = (operation) => async (req,res,next) => {
  try {
    const data=await applyPeerOperation(pool,configuredChrSync(),{
      peerId:Number(req.params.id),actorId:req.auth.id,operation,
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
    const { rows } = await pool.query(
      `select count(*)::int total,
      count(*) filter(where status='Online')::int online,
      count(*) filter(where status='Offline')::int offline,
      count(*) filter(where status='Expired')::int expired
      from app_clients where ($1='Admin' or owner_role=$1)`,
      [role],
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
    const { rows } = await pool.query(
      `select id,name,username "user",phone,package_name "package",
      router_name router,ip_address ip,expires_at "expiresAt",to_char(expires_at,'DD Mon YYYY') expiry,
      monthly_bill bill,status from app_clients
      where ($1='All' or status=$1) and (name ilike $2 or username ilike $2 or phone ilike $2)
      and ($3='Admin' or owner_role=$3)
      order by id`,
      [status, search, req.auth.role],
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
    !data.packageName ||
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
  'id,name,username "user",phone,package_name "package",router_name router,ip_address ip,expires_at "expiresAt",to_char(expires_at,\'DD Mon YYYY\') expiry,monthly_bill bill,status';

const syncRadiusUser = async (db, data, previousUsername = null) => {
  const oldUsername = previousUsername || data.username;
  await db.query("delete from radcheck where username=$1", [oldUsername]);
  await db.query("delete from radreply where username=$1", [oldUsername]);
  await db.query("delete from radusergroup where username=$1", [oldUsername]);
  const packageResult = await db.query(
    "select download_mbps,upload_mbps from app_packages where name=$1 and status='Active' order by case when owner_role='Admin' then 1 else 0 end limit 1",
    [data.packageName],
  );
  const speed = packageResult.rows[0] || {
    download_mbps: Number.parseInt(data.packageName) || 10,
    upload_mbps: Number.parseInt(data.packageName) || 10,
  };
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
    const owner =
      req.auth.role === "Admin" ? req.body.ownerRole || "Admin" : req.auth.role;
    if (!["Admin", "Reseller", "Sub-reseller"].includes(owner))
      return res.status(422).json({ error: "Invalid owner role" });
    const sql =
      "insert into app_clients(name,username,phone,package_name,router_name,ip_address,expires_at,monthly_bill,status,owner_role) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning " +
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
    ]);
    await syncRadiusUser(db, d);
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
    await db.query("begin");
    const { rows: old } = await db.query(
      "select * from app_clients where id=$1 and ($2='Admin' or owner_role=$2) for update",
      [req.params.id, req.auth.role],
    );
    if (!old[0]) {
      await db.query("rollback");
      return res.status(404).json({ error: "Client not found" });
    }
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
      "update app_clients set name=$1,username=$2,phone=$3,package_name=$4,router_name=$5,ip_address=$6,expires_at=$7,monthly_bill=$8,status=$9 where id=$10 returning " +
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
    ]);
    await syncRadiusUser(db, d, old[0].username);
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
    await db.query("begin");
    const { rows } = await db.query(
      "delete from app_clients where id=$1 and ($2='Admin' or owner_role=$2) returning *",
      [req.params.id, req.auth.role],
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
    const { rows } = await pool.query(
      'select id,name,download_mbps "downloadMbps",upload_mbps "uploadMbps",price,validity_days "validityDays",status,owner_role "ownerRole" from app_packages where ($1=\'Admin\' or owner_role in (\'Admin\',$1)) order by download_mbps,price',
      [req.auth.role],
    );
    res.json({ data: rows, count: rows.length });
  } catch (error) {
    next(error);
  }
});

app.post("/api/packages", authenticate, async (req, res, next) => {
  try {
    const d = parsePackage(req.body);
    const owner =
      req.auth.role === "Admin" ? req.body.ownerRole || "Admin" : req.auth.role;
    const { rows } = await pool.query(
      'insert into app_packages(name,download_mbps,upload_mbps,price,validity_days,owner_role,status) values($1,$2,$3,$4,$5,$6,$7) returning id,name,download_mbps "downloadMbps",upload_mbps "uploadMbps",price,validity_days "validityDays",status,owner_role "ownerRole"',
      [
        d.name,
        d.downloadMbps,
        d.uploadMbps,
        d.price,
        d.validityDays,
        owner,
        d.status,
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
    const { rows } = await pool.query(
      'update app_packages set name=$1,download_mbps=$2,upload_mbps=$3,price=$4,validity_days=$5,status=$6 where id=$7 and ($8=\'Admin\' or owner_role=$8) returning id,name,download_mbps "downloadMbps",upload_mbps "uploadMbps",price,validity_days "validityDays",status,owner_role "ownerRole"',
      [
        d.name,
        d.downloadMbps,
        d.uploadMbps,
        d.price,
        d.validityDays,
        d.status,
        req.params.id,
        req.auth.role,
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
    const { rows } = await pool.query(
      "delete from app_packages where id=$1 and ($2='Admin' or owner_role=$2) returning id",
      [req.params.id, req.auth.role],
    );
    if (!rows[0]) return res.status(404).json({ error: "Package not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Downloadable manual CHR peer command: public information only, not an activation.
app.get("/api/admin/vpn/peers/:id/routeros-script", authenticate, requireAdmin, async (req, res, next) => {
 if (!/^[1-9][0-9]*$/.test(req.params.id)) return res.status(422).json({ error: "Invalid peer ID" });
 try {
  const { rows } = await pool.query('select public_key "publicKey", host(tunnel_ip) "tunnelIp", status from vpn_peers where id=$1',[req.params.id]);
  if (!rows[0] || rows[0].status === "Revoked") return res.status(404).json({ error: "Available peer not found" });
  const script = renderRouterOsPeerScript(rows[0]);
  res.set("Cache-Control", "no-store");
  res.type("text/plain; charset=utf-8").send(`# Manual CHR-side peer command; NOT YET APPLIED\n${script}\n`);
 } catch (error) { next(error); }
});

// Registry remains Pending until an independently verified CHR sync is available.
app.get("/api/admin/vpn/peers", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('select id,name,public_key "publicKey",host(tunnel_ip) "tunnelIp",status,created_at "createdAt",revoked_at "revokedAt" from vpn_peers order by id desc');
    res.json({ data: rows, count: rows.length });
  } catch (error) { next(error); }
});

app.post("/api/admin/vpn/peers", authenticate, requireAdmin, async (req, res, next) => {
  const name = req.body?.name;
  const publicKey = req.body?.publicKey;
  if (typeof name !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9 _.-]{2,99}$/.test(name) || !validateWireGuardPublicKey(publicKey))
    return res.status(422).json({ error: "Valid peer name and WireGuard public key required" });
  let client;
  try {
    client = await pool.connect();
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(778001)");
    const { rows: allocated } = await client.query("select host(tunnel_ip) address from vpn_peers");
    const tunnelIp = allocateVpnAddress(allocated.map(row => row.address));
    const { rows } = await client.query(
      'insert into vpn_peers(name,public_key,tunnel_ip,created_by) values($1,$2,$3,$4) returning id,name,public_key "publicKey",host(tunnel_ip) "tunnelIp",status',
      [name.trim(),publicKey,tunnelIp,req.auth.id],
    );
    await client.query("insert into vpn_peer_audit(peer_id,actor_user_id,action) values($1,$2,'Created')",[rows[0].id,req.auth.id]);
    await client.query("commit");
    res.status(201).json({ data: rows[0], message: "Registered; router synchronization pending" });
  } catch (error) {
    if (client) await client.query("rollback").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ error: "Peer name, key or address already registered" });
    next(error);
  } finally { client?.release(); }
});

app.post("/api/admin/vpn/peers/:id/sync", authenticate, requireAdmin, peerOperation("Enable"));
app.post("/api/admin/vpn/peers/:id/disable", authenticate, requireAdmin, peerOperation("Disable"));
app.post("/api/admin/vpn/peers/:id/revoke", authenticate, requireAdmin, peerOperation("Revoke"));

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
