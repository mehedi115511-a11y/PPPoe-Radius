import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Bell,
  ChevronDown,
  CreditCard,
  FileText,
  Gauge,
  Headphones,
  LayoutDashboard,
  Menu,
  Network,
  Package,
  Plus,
  RadioTower,
  ReceiptText,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Signal,
  Users,
  UserRoundCog,
  WalletCards,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";
import "./session.jsx";
const traffic = [
  { t: "12 AM", down: 65 },
  { t: "4 AM", down: 48 },
  { t: "8 AM", down: 110 },
  { t: "12 PM", down: 162 },
  { t: "4 PM", down: 205 },
  { t: "8 PM", down: 236 },
  { t: "Now", down: 198 },
];
const clients = [
  {
    name: "Saifan Net 1021",
    user: "saifan-net-1021",
    phone: "01700-000001",
    package: "20 Mbps",
    router: "Dhaka-Core-01",
    ip: "10.22.4.18",
    expiry: "17 Oct 2026",
    bill: "৳800",
    status: "Online",
  },
  {
    name: "Rahim Home",
    user: "rahim-home-77",
    phone: "01800-000077",
    package: "10 Mbps",
    router: "Gazipur-NAS-02",
    ip: "10.23.8.201",
    expiry: "12 Oct 2026",
    bill: "৳500",
    status: "Offline",
  },
  {
    name: "Hasan Office",
    user: "hasan-office-12",
    phone: "01900-000012",
    package: "30 Mbps",
    router: "Narayanganj-01",
    ip: "10.24.1.94",
    expiry: "28 Sep 2026",
    bill: "৳1,200",
    status: "Online",
  },
  {
    name: "Mim Enterprise",
    user: "mim-enterprise",
    phone: "01600-000009",
    package: "50 Mbps",
    router: "Dhaka-Core-01",
    ip: "10.22.9.11",
    expiry: "15 Sep 2026",
    bill: "৳2,000",
    status: "Expired",
  },
  {
    name: "Jahid Telecom",
    user: "jahid-tel-08",
    phone: "01300-000008",
    package: "20 Mbps",
    router: "Comilla-NAS-01",
    ip: "10.25.7.32",
    expiry: "03 Oct 2026",
    bill: "৳800",
    status: "Offline",
  },
];
const formatClient = (client) => ({
  ...client,
  bill:
    typeof client.bill === "string" && client.bill.startsWith("৳")
      ? client.bill
      : `৳${Number(client.bill || 0).toLocaleString("en-BD")}`,
});
const apiGet = async (path) => {
  const token = localStorage.getItem("pppoe_token");
  const response = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Unable to load live data");
  return response.json();
};
const apiSend = async (path, method, body) => {
  const token = localStorage.getItem("pppoe_token");
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};
const nav = [
  [
    "Workspace",
    [
      ["Dashboard", LayoutDashboard],
      ["Clients", Users],
      ["Live Sessions", Activity],
    ],
  ],
  [
    "Services",
    [
      ["Packages", Package],
      ["IP Pools", Network],
      ["Routers / NAS", Server],
      ["VPN", ShieldCheck],
      ["RADIUS Monitor", RadioTower],
    ],
  ],
  [
    "Business",
    [
      ["Resellers", UserRoundCog],
      ["Wallet & Ledger", WalletCards],
      ["Billing", ReceiptText],
      ["Reports", FileText],
    ],
  ],
  [
    "Account",
    [
      ["My Profile", ShieldCheck],
      ["Settings", Settings],
    ],
  ],
];
const roles = {
  Admin: {
    title: "ISP Administrator",
    org: "NextGan Networks",
    counts: [
      ["Total Clients", "12,840", Users, "violet"],
      ["Online", "8,426", Signal, "cyan"],
      ["Offline", "3,546", Wifi, "orange"],
      ["Expired", "868", CreditCard, "red"],
    ],
  },
  Reseller: {
    title: "Reseller Dashboard",
    org: "Saifan Distribution",
    counts: [
      ["Total Clients", "486", Users, "violet"],
      ["Online", "328", Signal, "cyan"],
      ["Offline", "124", Wifi, "orange"],
      ["Expired", "34", CreditCard, "red"],
    ],
  },
  "Sub-reseller": {
    title: "Sub-reseller Dashboard",
    org: "Gazipur Zone",
    counts: [
      ["Total Clients", "128", Users, "violet"],
      ["Online", "84", Signal, "cyan"],
      ["Offline", "35", Wifi, "orange"],
      ["Expired", "9", CreditCard, "red"],
    ],
  },
};
function Stat({ x }) {
  const [L, V, I, T] = x;
  return (
    <article className={`stat ${T}`}>
      <div className="stat-top">
        <span className="stat-icon">
          <I />
        </span>
      </div>
      <strong>{V}</strong>
      <p>{L}</p>
    </article>
  );
}
function Table({ rows, compact, onAction }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Username</th>
            <th>Package</th>
            {!compact && <th>Router / IP</th>}
            <th>Expiry</th>
            {!compact && <th>Bill</th>}
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.user}>
              <td>
                <b>{c.name}</b>
                {!compact && <small className="cell-sub">{c.phone}</small>}
              </td>
              <td>{c.user}</td>
              <td>
                <span className="plan-pill">{c.package}</span>
              </td>
              {!compact && (
                <td>
                  {c.router}
                  <small className="cell-sub">{c.ip}</small>
                </td>
              )}
              <td>{c.expiry}</td>
              {!compact && <td>{c.bill}</td>}
              <td>
                <span className={`status ${c.status.toLowerCase()}`}>
                  <i />
                  {c.status}
                </span>
              </td>
              <td>
                <button
                  className="row-action"
                  onClick={() => onAction?.(c)}
                  aria-label={`Manage ${c.name}`}
                >
                  •••
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Dashboard({ role }) {
  let c = roles[role];
  const [counts, setCounts] = useState(c.counts);
  const [recentClients, setRecentClients] = useState(clients.slice(0, 4));
  useEffect(() => {
    let active = true;
    setCounts(c.counts);
    Promise.all([
      apiGet(`/api/dashboard?role=${encodeURIComponent(role)}`),
      apiGet("/api/clients"),
    ])
      .then(([summary, clientResponse]) => {
        if (!active) return;
        setCounts([
          ["Total Clients", String(summary.total), Users, "violet"],
          ["Online", String(summary.online), Signal, "cyan"],
          ["Offline", String(summary.offline), Wifi, "orange"],
          ["Expired", String(summary.expired), CreditCard, "red"],
        ]);
        setRecentClients(clientResponse.data.slice(0, 4).map(formatClient));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [role]);
  return (
    <div className="content">
      <section className="welcome">
        <div>
          <p>THURSDAY, 17 SEPTEMBER</p>
          <h1>{c.title}</h1>
          <span>Everything important, in one clean view</span>
        </div>
        <div className="period">
          <button className="selected">Today</button>
          <button>7 days</button>
          <button>30 days</button>
        </div>
      </section>
      <section className="stats">
        {counts.map((x) => (
          <Stat x={x} key={x[0]} />
        ))}
      </section>
      <section className="minimal-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Live Bandwidth</h2>
              <p>All active sessions</p>
            </div>
            <div className="throughput">
              <b>198.4</b>
              <span>↓ Mbps</span>
              <b>78.2</b>
              <span>↑ Mbps</span>
            </div>
          </div>
          <div className="chart compact">
            <ResponsiveContainer>
              <AreaChart data={traffic}>
                <defs>
                  <linearGradient id="tf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#5b5cf0" stopOpacity={0.35} />
                    <stop offset="1" stopColor="#5b5cf0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="t" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="down"
                  stroke="#5b5cf0"
                  strokeWidth={3}
                  fill="url(#tf)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel quick-panel">
          <div className="panel-head">
            <div>
              <h2>{role === "Admin" ? "System Status" : "Wallet Summary"}</h2>
              <p>Live operational health</p>
            </div>
            <span className="health-badge">
              <i />
              Healthy
            </span>
          </div>
          {role === "Admin" ? (
            <div className="mini-list">
              <div>
                <span>
                  <Server />
                  Routers / NAS
                </span>
                <b>24 / 25</b>
              </div>
              <div>
                <span>
                  <RadioTower />
                  RADIUS nodes
                </span>
                <b>2 / 2</b>
              </div>
              <div>
                <span>
                  <Gauge />
                  Auth latency
                </span>
                <b>18 ms</b>
              </div>
              <div>
                <span>
                  <ShieldCheck />
                  Auth success
                </span>
                <b>99.4%</b>
              </div>
            </div>
          ) : (
            <div className="wallet-summary">
              <small>Available wallet</small>
              <strong>৳84,650</strong>
              <span>৳12,800 recharged today</span>
              <button>Open wallet & ledger</button>
            </div>
          )}
        </article>
      </section>
      <section className="panel concise-table">
        <div className="panel-head">
          <div>
            <h2>Recent Clients</h2>
            <p>Latest subscriber activity</p>
          </div>
          <button>View all clients</button>
        </div>
        <Table rows={recentClients} compact />
      </section>
    </div>
  );
}
function Clients() {
  let [q, setQ] = useState(""),
    [f, setF] = useState("All"),
    [clientData, setClientData] = useState(clients),
    [availablePackages, setAvailablePackages] = useState([]),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(""),
    [editing, setEditing] = useState(null),
    [formOpen, setFormOpen] = useState(false);
  const loadClients = () => {
    let active = true;
    setLoading(true);
    Promise.all([apiGet("/api/clients"), apiGet("/api/packages")])
      .then(([response, packagesResponse]) => {
        if (active) {
          setClientData(response.data.map(formatClient));
          setAvailablePackages(packagesResponse.data.filter((item) => item.status === "Active"));
          setLoadError("");
        }
      })
      .catch(() => active && setLoadError("Live data unavailable"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  };
  useEffect(() => {
    return loadClients();
  }, []);
  const openCreate = () => {
    setEditing(null);
    setLoadError("");
    setFormOpen(true);
  };
  const openEdit = (client) => {
    setEditing(client);
    setLoadError("");
    setFormOpen(true);
  };
  const saveClient = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLoadError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    values.monthlyBill = Number(values.monthlyBill);
    try {
      await apiSend(
        editing ? `/api/clients/${editing.id}` : "/api/clients",
        editing ? "PATCH" : "POST",
        values,
      );
      setFormOpen(false);
      setEditing(null);
      loadClients();
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  };
  const deleteClient = async () => {
    if (
      !editing ||
      !window.confirm(`Delete ${editing.name}? History will be retained.`)
    )
      return;
    setLoading(true);
    try {
      await apiSend(`/api/clients/${editing.id}`, "DELETE");
      setFormOpen(false);
      setEditing(null);
      loadClients();
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  };
  let rows = useMemo(
    () =>
      clientData.filter(
        (c) =>
          (f === "All" || c.status === f) &&
          `${c.name} ${c.user} ${c.phone}`
            .toLowerCase()
            .includes(q.toLowerCase()),
      ),
    [q, f, clientData],
  );
  return (
    <div className="content">
      <section className="page-title">
        <div>
          <h1>Clients</h1>
          <p>Accounts, packages, billing and sessions</p>
        </div>
        <button className="quick" onClick={openCreate}>
          <Plus />
          Add Client
        </button>
      </section>
      <section className="panel client-panel">
        {loadError && <div className="data-warning">{loadError}</div>}
        {loading && <div className="data-loading">Updating live clients…</div>}
        <div className="client-tools">
          <div className="search inner">
            <Search />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, username or mobile"
            />
          </div>
          <div className="filters">
            {["All", "Online", "Offline", "Expired"].map((x) => (
              <button
                className={f === x ? "selected" : ""}
                onClick={() => setF(x)}
                key={x}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
        <Table rows={rows} onAction={openEdit} />
        {!rows.length && (
          <div className="empty">No clients matched this filter.</div>
        )}
      </section>
      {formOpen && (
        <div className="client-modal-backdrop">
          <form className="client-modal" onSubmit={saveClient}>
            <header>
              <div>
                <h2>{editing ? "Edit Client" : "Add Client"}</h2>
                <p>PPPoE account and billing information</p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Close client form"
              >
                <X />
              </button>
            </header>
            {loadError && <div className="auth-error">{loadError}</div>}
            <div className="client-form-grid">
              <label>
                Client Name
                <input
                  name="name"
                  defaultValue={editing?.name || ""}
                  required
                />
              </label>
              <label>
                Username
                <input
                  name="username"
                  defaultValue={editing?.user || ""}
                  required
                />
              </label>
              <label>
                PPPoE Password
                <input
                  name="password"
                  type="password"
                  minLength="6"
                  placeholder={
                    editing
                      ? "Leave blank to keep current"
                      : "Minimum 6 characters"
                  }
                  required={!editing}
                />
              </label>
              <label>
                Mobile
                <input
                  name="phone"
                  defaultValue={editing?.phone || ""}
                  required
                />
              </label>
              <label>
                Package
                <select name="packageId" defaultValue={editing?.packageId || ""} required>
                  <option value="" disabled>Select an owned package</option>
                  {availablePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>{pkg.name} — ৳{pkg.price}</option>
                  ))}
                </select>
              </label>
              <label>
                Router / NAS
                <input
                  name="router"
                  defaultValue={editing?.router || ""}
                  required
                />
              </label>
              <label>
                Static IP
                <input
                  name="ip"
                  defaultValue={editing?.ip || ""}
                  placeholder="Optional"
                />
              </label>
              <label>
                Expiry Date
                <input
                  type="date"
                  name="expiresAt"
                  defaultValue={editing?.expiresAt?.slice(0, 10) || ""}
                  required
                />
              </label>
              <label>
                Monthly Bill
                <input
                  type="number"
                  min="0"
                  name="monthlyBill"
                  defaultValue={
                    editing
                      ? Number(String(editing.bill).replace(/[^0-9.]/g, ""))
                      : ""
                  }
                  required
                />
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={editing?.status || "Offline"}
                >
                  <option>Online</option>
                  <option>Offline</option>
                  <option>Expired</option>
                </select>
              </label>
              <label>
                Simultaneous Sessions
                <input
                  type="number"
                  name="simultaneousUse"
                  min="1"
                  max="10"
                  defaultValue="1"
                  required
                />
              </label>
            </div>
            <footer>
              {editing && (
                <button type="button" className="danger" onClick={deleteClient}>
                  Delete Client
                </button>
              )}
              <span />
              <button type="button" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
              <button className="primary" disabled={loading}>
                {loading ? "Saving…" : "Save Client"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
function Packages() {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(null),
    [open, setOpen] = useState(false);
  const load = () => {
    setLoading(true);
    apiGet("/api/packages")
      .then((r) => {
        setItems(r.data);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const save = async (event) => {
    event.preventDefault();
    setLoading(true);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.downloadMbps = Number(body.downloadMbps);
    body.uploadMbps = Number(body.uploadMbps);
    body.price = Number(body.price);
    body.validityDays = Number(body.validityDays);
    try {
      await apiSend(
        editing ? `/api/packages/${editing.id}` : "/api/packages",
        editing ? "PATCH" : "POST",
        body,
      );
      setOpen(false);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };
  const remove = async () => {
    if (!editing || !window.confirm(`Delete package ${editing.name}?`)) return;
    try {
      await apiSend(`/api/packages/${editing.id}`, "DELETE");
      setOpen(false);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="content">
      <section className="page-title">
        <div>
          <h1>Packages</h1>
          <p>Speed, pricing and validity plans</p>
        </div>
        <button
          className="quick"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus />
          Add Package
        </button>
      </section>
      {error && <div className="data-warning">{error}</div>}
      <section className="package-grid">
        {loading && !items.length ? (
          <div className="data-loading">Loading packages…</div>
        ) : (
          items.map((p) => (
            <article className="package-card" key={p.id}>
              <div>
                <span className={p.status.toLowerCase()}>{p.status}</span>
                <button
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                  aria-label={`Edit ${p.name}`}
                >
                  •••
                </button>
              </div>
              <Package />
              <h2>{p.name}</h2>
              <strong>৳{Number(p.price).toLocaleString("en-BD")}</strong>
              <p>per {p.validityDays} days</p>
              <ul>
                <li>↓ {p.downloadMbps} Mbps Download</li>
                <li>↑ {p.uploadMbps} Mbps Upload</li>
                <li>{p.ownerRole} package</li>
              </ul>
            </article>
          ))
        )}
      </section>
      {open && (
        <div className="client-modal-backdrop">
          <form className="client-modal package-modal" onSubmit={save}>
            <header>
              <div>
                <h2>{editing ? "Edit Package" : "Add Package"}</h2>
                <p>Configure PPPoE speed and pricing</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close package form"
              >
                <X />
              </button>
            </header>
            {error && <div className="auth-error">{error}</div>}
            <div className="client-form-grid">
              <label>
                Package Name
                <input
                  name="name"
                  defaultValue={editing?.name || ""}
                  required
                />
              </label>
              <label>
                Price (৳)
                <input
                  name="price"
                  type="number"
                  min="0"
                  defaultValue={editing?.price || ""}
                  required
                />
              </label>
              <label>
                Download Mbps
                <input
                  name="downloadMbps"
                  type="number"
                  min="1"
                  defaultValue={editing?.downloadMbps || ""}
                  required
                />
              </label>
              <label>
                Upload Mbps
                <input
                  name="uploadMbps"
                  type="number"
                  min="1"
                  defaultValue={editing?.uploadMbps || ""}
                  required
                />
              </label>
              <label>
                Validity Days
                <input
                  name="validityDays"
                  type="number"
                  min="1"
                  defaultValue={editing?.validityDays || 30}
                  required
                />
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={editing?.status || "Active"}
                >
                  <option>Active</option>
                  <option>Disabled</option>
                </select>
              </label>
            </div>
            <footer>
              {editing && (
                <button type="button" className="danger" onClick={remove}>
                  Delete Package
                </button>
              )}
              <span />
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="primary" disabled={loading}>
                {loading ? "Saving…" : "Save Package"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
function VpnManagement() {
  const [items,setItems]=useState([]),[name,setName]=useState(""),[routerOsMajor,setRouterOsMajor]=useState("7"),
    [script,setScript]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const load=()=>apiGet("/api/admin/vpn/peers").then(r=>setItems(r.data)).catch(e=>setError(e.message));
  useEffect(()=>{ load(); },[]);
  const create=async(event)=>{
    event.preventDefault(); setLoading(true); setError(""); setScript("");
    try {
      const response=await apiSend("/api/admin/vpn/peers","POST",{name,routerOsMajor:Number(routerOsMajor)});
      setScript(response.data.script); setName(""); await load();
    } catch(e) { setError(e.message); } finally { setLoading(false); }
  };
  const action=async(id,operation)=>{
    try { await apiSend(`/api/admin/vpn/peers/${id}/${operation}`,"POST"); await load(); }
    catch(e) { setError(e.message); }
  };
  const download=()=>{
    const url=URL.createObjectURL(new Blob([script],{type:"text/plain"}));
    const link=document.createElement("a"); link.href=url; link.download="nextgan-vpn.rsc"; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="content">
    <section className="page-title"><div><h1>VPN</h1><p>Create RouterOS 6 or 7 ready-to-paste VPN configurations</p></div></section>
    {error&&<div className="data-warning">{error}</div>}
    <section className="panel vpn-create">
      <h2>Create VPN</h2>
      <form onSubmit={create} className="vpn-form">
        <label>VPN Name<input value={name} onChange={e=>setName(e.target.value)} required minLength="3" placeholder="Branch Router"/></label>
        <label>RouterOS Version<select value={routerOsMajor} onChange={e=>setRouterOsMajor(e.target.value)}>
          <option value="7">RouterOS 7 — WireGuard</option>
          <option value="6">RouterOS 6 — L2TP/IPsec</option>
        </select></label>
        <button className="quick" disabled={loading}>{loading?"Creating…":"Create VPN & Script"}</button>
      </form>
    </section>
    {script&&<section className="panel vpn-script">
      <div className="panel-title"><div><h2>One-time MikroTik Script</h2><p>Copy or download now. The private credential is not shown again.</p></div>
        <div><button onClick={()=>navigator.clipboard.writeText(script)}>Copy Script</button><button className="quick" onClick={download}>Download .rsc</button></div>
      </div>
      <pre>{script}</pre>
    </section>}
    <section className="panel"><div className="panel-title"><div><h2>VPN Connections</h2><p>RouterOS version, protocol and synchronization state</p></div>
      <button onClick={()=>apiSend("/api/admin/vpn/peers/reconcile","POST").then(load).catch(e=>setError(e.message))}>Reconcile</button></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>RouterOS</th><th>Protocol</th><th>VPN IP</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{items.map(peer=><tr key={peer.id}><td>{peer.name}</td><td>OS {peer.routerOsMajor}</td><td>{peer.protocol}</td><td>{peer.tunnelIp}</td><td>{peer.status}</td>
       <td>{peer.protocol==="wireguard"&&<><button onClick={()=>action(peer.id,"sync")}>Connect</button><button onClick={()=>action(peer.id,"disable")}>Disable</button></>}<button onClick={()=>action(peer.id,"revoke")}>Revoke</button></td>
      </tr>)}</tbody></table></div>
    </section>
  </div>;
}

function Simple({ name }) {
  return (
    <div className="content">
      <section className="page-title">
        <div>
          <h1>{name}</h1>
          <p>Focused workspace for {name.toLowerCase()}.</p>
        </div>
      </section>
      <section className="panel module-placeholder">
        <div className="placeholder-icon">
          <Zap />
        </div>
        <h2>{name} workspace</h2>
        <p>
          Responsive layout is ready. Forms, validation and API operations
          follow in the next checkpoint.
        </p>
      </section>
    </div>
  );
}
export function App() {
  let [open, setOpen] = useState(false),
    [active, setActive] = useState("Dashboard"),
    [role, setRole] = useState("Admin");
  let page =
    active === "Dashboard" ? (
      <Dashboard role={role} />
    ) : active === "Clients" ? (
      <Clients />
    ) : active === "Packages" ? (
      <Packages />
    ) : active === "VPN" ? (
      <VpnManagement />
    ) : (
      <Simple name={active} />
    );
  return (
    <div className="app">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">
            <RadioTower />
          </div>
          <div>
            <b>PPPoE</b>
            <span>RADIUS INTEGRATION</span>
          </div>
          <button
            className="side-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>
        <div className="tenant">
          <div className="tenant-icon">NG</div>
          <div>
            <small>{role} view</small>
            <strong>{roles[role].org}</strong>
          </div>
          <ChevronDown />
        </div>
        <nav>
          {nav.map(([g, is]) => (
            <div className="nav-group" key={g}>
              <p>{g}</p>
              {is.map(([n, I]) => (
                <button
                  key={n}
                  className={active === n ? "active" : ""}
                  onClick={() => {
                    setActive(n);
                    setOpen(false);
                  }}
                >
                  <I />
                  <span>{n}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="support">
          <Headphones />
          <div>
            <b>Need assistance?</b>
            <span>24/7 Network Support</span>
          </div>
        </div>
        <div className="profile">
          <div className="avatar">SI</div>
          <div>
            <b>Saifan Islam</b>
            <span>{roles[role].title}</span>
          </div>
          <button aria-label="Profile settings">
            <Settings />
          </button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main>
        <header>
          <button
            className="menu"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>
          <div className="search">
            <Search />
            <input placeholder="Search clients, routers, invoices..." />
          </div>
          <div className="head-actions">
            <select
              className="role-select"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setActive("Dashboard");
              }}
              aria-label="Preview user role"
            >
              <option>Admin</option>
              <option>Reseller</option>
              <option>Sub-reseller</option>
            </select>
            <div className="live">
              <i />
              RADIUS Live
            </div>
            <button className="icon-btn" aria-label="Notifications">
              <Bell />
              <span>3</span>
            </button>
            <button className="quick">
              <Zap />
              Quick Recharge
            </button>
          </div>
        </header>
        {page}
      </main>
    </div>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
