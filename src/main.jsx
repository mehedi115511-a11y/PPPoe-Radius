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
import RouterWorkspace from "./RouterWorkspace.jsx";
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
const apiSend = async (path, method, body, extraHeaders = {}) => {
  const token = localStorage.getItem("pppoe_token");
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
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
function IpPools() {
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),
    [saving,setSaving]=useState(false),[error,setError]=useState(""),
    [editing,setEditing]=useState(null),[open,setOpen]=useState(false);
  const load=()=>apiGet("/api/ip-pools")
    .then(response=>{setItems(response.data);setError("")})
    .catch(e=>setError(e.message)).finally(()=>setLoading(false));
  useEffect(()=>{load()},[]);
  const save=async event=>{
    event.preventDefault();setSaving(true);setError("");
    try {
      const body=Object.fromEntries(new FormData(event.currentTarget));
      await apiSend(editing?`/api/ip-pools/${editing.id}`:"/api/ip-pools",editing?"PATCH":"POST",body);
      setOpen(false);setEditing(null);await load();
    }catch(e){setError(e.message)}
    finally{setSaving(false)}
  };
  const remove=async()=>{
    if(!editing||!window.confirm(`Delete software IP pool ${editing.name}?`))return;
    setSaving(true);
    try{await apiSend(`/api/ip-pools/${editing.id}`,"DELETE");setOpen(false);setEditing(null);await load()}
    catch(e){setError(e.message)}
    finally{setSaving(false)}
  };
  return <div className="content">
    <section className="page-title"><div><h1>IP Pools</h1><p>Tenant IP ranges for planning PPPoE address allocation</p></div>
      <button className="quick" onClick={()=>{setEditing(null);setOpen(true);setError("")}}><Plus/>Add IP Pool</button>
    </section>
    <section className="panel"><p>These are software pool definitions. Adding one here does not configure a MikroTik router.</p></section>
    {error&&<div className="data-warning" role="alert">{error}</div>}
    <section className="package-grid">
      {loading?<div className="data-loading">Loading IP pools...</div>:items.length===0?<div className="panel">No IP pools yet.</div>:items.map(item=>
        <article className="package-card" key={item.id}>
          <div><span className={item.status.toLowerCase()}>{item.status}</span>
            <button aria-label={`Edit pool ${item.name}`} onClick={()=>{setEditing(item);setOpen(true);setError("")}}>...</button></div>
          <Network/><h2>{item.name}</h2><strong>{item.network}</strong>
          <p>Software definition</p>
        </article>)}
    </section>
    {open&&<div className="client-modal-backdrop"><form className="client-modal package-modal" onSubmit={save}>
      <header><div><h2>{editing?"Edit IP Pool":"Add IP Pool"}</h2><p>Use a non-overlapping IPv4 network (CIDR).</p></div>
        <button type="button" aria-label="Close IP pool form" onClick={()=>setOpen(false)}><X/></button></header>
      {error&&<div className="auth-error" role="alert">{error}</div>}
      <div className="client-form-grid">
        <label>Pool Name<input name="name" defaultValue={editing?.name||""} minLength="2" maxLength="80" required/></label>
        <label>IPv4 Network (CIDR)<input name="network" placeholder="10.20.0.0/24" defaultValue={editing?.network||""} required/></label>
        <label>Status<select name="status" defaultValue={editing?.status||"Active"}><option>Active</option><option>Disabled</option></select></label>
      </div>
      <footer>{editing&&<button type="button" className="danger" disabled={saving} onClick={remove}>Delete IP Pool</button>}
        <span/><button type="button" onClick={()=>setOpen(false)}>Cancel</button>
        <button className="primary" disabled={saving}>{saving?"Saving...":"Save IP Pool"}</button>
      </footer>
    </form></div>}
  </div>;
}
function WalletWorkspace({role}) {
  const [wallet,setWallet]=useState(null),[entries,setEntries]=useState([]),
    [receipts,setReceipts]=useState([]),[error,setError]=useState(""),
    [funding,setFunding]=useState([]),[provider,setProvider]=useState("bkash"),
    [reference,setReference]=useState(""),[amount,setAmount]=useState(""),
    [requestKey,setRequestKey]=useState(null),[reviewId,setReviewId]=useState(""),
    [decision,setDecision]=useState("evidence_ok"),[reviewNote,setReviewNote]=useState(""),
    [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    Promise.all([apiGet("/api/wallet"),apiGet("/api/wallet/ledger"),apiGet("/api/recharges")])
      .then(([balance,ledger,recharges])=>{
        if(active){setWallet(balance.data);setEntries(ledger.data);setReceipts(recharges.data);}
      })
      .catch(e=>active&&setError(e.message));
    return()=>{active=false};
  },[]);
  const fundingPath=role==="Admin"?"/api/admin/wallet/funding-requests":"/api/wallet/funding-requests";
  useEffect(()=>{
    let active=true;
    apiGet(fundingPath).then(result=>active&&setFunding(result.data))
      .catch(e=>active&&setError(e.message));
    return()=>{active=false};
  },[fundingPath]);
  const loadFunding=()=>apiGet(fundingPath).then(result=>setFunding(result.data));
  const submitEvidence=async e=>{
    e.preventDefault();setBusy(true);setError("");
    const key=requestKey||crypto.randomUUID();setRequestKey(key);
    try{
      await apiSend("/api/wallet/funding-requests","POST",
        {provider,externalReference:reference,amount},{"Idempotency-Key":key});
      setReference("");setAmount("");setRequestKey(null);await loadFunding();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  };
  const submitReview=async e=>{
    e.preventDefault();setBusy(true);setError("");
    try{
      await apiSend(`/api/admin/wallet/funding-requests/${reviewId}/review`,"POST",
        {decision,note:reviewNote});
      setReviewNote("");setReviewId("");await loadFunding();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  };
  const money=value=>`৳${(Number(value)/100).toFixed(2)}`;
  return <div className="content">
    <section className="page-title"><div><h1>Wallet & Ledger</h1><p>Current balance and recorded transactions</p></div></section>
    {error&&<div className="data-warning">{error}</div>}
    <section className="panel"><h2>Available balance</h2><strong>{wallet?money(wallet.balanceMinor):"—"}</strong></section>
    <section className="panel vpn-create"><h2>Submit payment evidence</h2><p>Submission and review do not credit your wallet.</p>
      <form className="vpn-form" onSubmit={submitEvidence}>
        <label>Payment provider<select value={provider} onChange={e=>{setProvider(e.target.value);setRequestKey(null)}}>
          <option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="bank">Bank</option>
        </select></label>
        <label>Payment reference<input value={reference} onChange={e=>{setReference(e.target.value);setRequestKey(null)}} minLength="6" maxLength="120" required/></label>
        <label>Amount BDT<input type="text" inputMode="decimal" pattern="(0|[1-9][0-9]*)(\.[0-9]{1,2})?" value={amount} onChange={e=>{setAmount(e.target.value);setRequestKey(null)}} required/></label>
        <button disabled={busy}>{busy?"Submitting...":"Submit evidence"}</button>
      </form>
    </section>
    {role==="Admin"&&<section className="panel vpn-create"><h2>Review payment evidence</h2><p>Review records a decision only. It does not fund a wallet.</p>
      <form className="vpn-form" onSubmit={submitReview}>
        <label>Request<select value={reviewId} onChange={e=>setReviewId(e.target.value)} required><option value="">Select pending request</option>
          {funding.filter(item=>!item.decision).map(item=><option value={item.id} key={item.id}>{item.id}: {item.provider} {item.externalReference}</option>)}
        </select></label>
        <label>Decision<select value={decision} onChange={e=>setDecision(e.target.value)}><option value="evidence_ok">Evidence checked</option><option value="rejected">Rejected</option></select></label>
        <label>Review note<input value={reviewNote} onChange={e=>setReviewNote(e.target.value)} minLength="4" maxLength="500" required/></label>
        <button disabled={busy}>Record review</button>
      </form>
    </section>}
    <section className="panel"><h2>Payment evidence history</h2><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Provider</th><th>Amount</th><th>Review</th></tr></thead>
      <tbody>{funding.map(item=><tr key={item.id}><td>{item.externalReference}</td><td>{item.provider}</td><td>{money(item.amountMinor)}</td><td>{item.decision||"Pending"}</td></tr>)}</tbody></table></div></section>
    <section className="panel"><h2>Ledger history</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Operation</th><th>Direction</th><th>Amount</th></tr></thead>
      <tbody>{entries.map((item,index)=><tr key={`${item.id}-${index}`}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.operation}</td><td>{item.direction}</td><td>{money(item.amountMinor)}</td></tr>)}</tbody></table></div></section>
    <section className="panel"><h2>Recharge receipts</h2><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Mode</th><th>Amount</th><th>Expiry</th></tr></thead>
      <tbody>{receipts.map(item=><tr key={item.id}><td>{item.receiptReference}</td><td>{item.mode}</td><td>{money(item.amountMinor)}</td><td>{String(item.newExpiry).slice(0,10)}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function BillingWorkspace() {
  const [clients,setClients]=useState([]),[clientId,setClientId]=useState(""),
    [mode,setMode]=useState("full_cycle"),[days,setDays]=useState("1"),
    [busy,setBusy]=useState(false),[error,setError]=useState(""),[receipt,setReceipt]=useState(null),
    [requestKey,setRequestKey]=useState(null),[quote,setQuote]=useState(null),
    [quoteVersion,setQuoteVersion]=useState(0),[reconciliation,setReconciliation]=useState(null);
  useEffect(()=>{
    let active=true;
    apiGet("/api/clients").then(response=>active&&setClients(response.data))
      .catch(e=>active&&setError(e.message));
    return()=>{active=false};
  },[]);
  useEffect(()=>{
    let active=true;
    setQuote(null);
    if(clientId && (mode!=="custom_days" || Number(days)>0))
      apiGet(`/api/clients/${clientId}/recharge-quote?mode=${mode}${mode==="custom_days"?`&selectedDays=${encodeURIComponent(days)}`:""}`)
        .then(result=>active&&setQuote(result.data))
        .catch(e=>active&&setError(e.message));
    return()=>{active=false};
  },[clientId,mode,days,quoteVersion]);
  const submit=async(event)=>{
    event.preventDefault();if(!quote || String(quote.clientId)!==String(clientId) || quote.mode!==mode || (mode==='custom_days' && Number(quote.selectedDays)!==Number(days)))return;
    setBusy(true);setError("");
    const key=requestKey||crypto.randomUUID();
    setRequestKey(key);
    try{
      const response=await apiSend(`/api/clients/${clientId}/recharge`,"POST",
        {mode,rechargeDate:quote.rechargeDate,expectedAmountMinor:quote.amountMinor,
          ...(mode==="custom_days"?{selectedDays:Number(days)}:{})},{"Idempotency-Key":key});
      setReceipt(response.data);setReconciliation(null);setRequestKey(null);
    }catch(e){
      setError(e.message);
      if(e.message.includes("quote changed")){setRequestKey(null);setQuoteVersion(v=>v+1)}
    }
    finally{setBusy(false)}
  };
  const changeRequest=()=>{setReceipt(null);setReconciliation(null);setRequestKey(null);setQuote(null)};
  const verifyReceipt=()=>apiGet(`/api/recharges/${receipt.id}/reconciliation`)
    .then(result=>{setReconciliation(result.data);setError("")})
    .catch(e=>setError(e.message));
  return <div className="content">
    <section className="page-title"><div><h1>Billing</h1><p>Recharge an owned client from your wallet</p></div></section>
    {error&&<div className="data-warning">{error}</div>}
    <section className="panel vpn-create"><h2>Recharge client</h2><form className="vpn-form" onSubmit={submit}>
      <label>Client<select value={clientId} onChange={e=>{setClientId(e.target.value);changeRequest()}} required><option value="">Select client</option>
        {clients.map(c=><option key={c.id} value={c.id}>{c.name} — {c.user}</option>)}</select></label>
      <label>Recharge mode<select value={mode} onChange={e=>{setMode(e.target.value);changeRequest()}}>
        <option value="full_cycle">Full cycle — one calendar month</option>
        <option value="custom_days">Custom days — prorated</option>
      </select></label>
      {mode==="custom_days"&&<label>Selected days<input type="number" min="1" max="366" value={days} onChange={e=>{setDays(e.target.value);changeRequest()}} required/></label>}
      <button className="quick" disabled={busy||!quote||String(quote.clientId)!==String(clientId)||quote.mode!==mode||(mode==='custom_days'&&Number(quote.selectedDays)!==Number(days))}>{busy?"Posting…":"Post Recharge"}</button>
    </form>
    {quote&&<p role="status">Charge preview: ৳{(Number(quote.amountMinor)/100).toFixed(2)}
      {" "}— New expiry: {String(quote.newExpiry).slice(0,10)}</p>}
    </section>
    {receipt&&<section className="panel" role="status"><h2>Recharge receipt</h2>
      <p>Reference: {receipt.receiptReference}</p><p>Amount: ৳{(Number(receipt.amountMinor)/100).toFixed(2)}</p>
      <p>Expiry: {String(receipt.previousExpiry).slice(0,10)} → {String(receipt.newExpiry).slice(0,10)}</p>
      <button onClick={verifyReceipt}>Verify receipt</button>
      {reconciliation&&<p>Ledger reconciliation: {reconciliation.status} ({reconciliation.entryCount} entries)</p>}
    </section>}
  </div>;
}

function VpnManagement() {
  const [items,setItems]=useState([]),[name,setName]=useState(""),[routerOsMajor,setRouterOsMajor]=useState("7"),
    [script,setScript]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false),
    [readiness,setReadiness]=useState(null),[readback,setReadback]=useState(null);
  const selectedReadiness=readiness?.[routerOsMajor==="6"?"routerOs6":"routerOs7"];
  const load=()=>apiGet("/api/admin/vpn/peers").then(r=>setItems(r.data)).catch(e=>setError(e.message));
  useEffect(()=>{ load(); apiGet("/api/admin/vpn/readiness").then(r=>setReadiness(r.data)).catch(()=>{}); },[]);
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
  const checkChr=()=>apiGet("/api/admin/vpn/chr-readback")
    .then(response=>{setReadback(response.data);setError("")})
    .catch(e=>setError(e.message));
  const download=()=>{
    const url=URL.createObjectURL(new Blob([script],{type:"text/plain"}));
    const link=document.createElement("a"); link.href=url; link.download="nextgan-vpn.rsc"; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="content">
    <section className="page-title"><div><h1>VPN</h1><p>Create RouterOS 6 or 7 ready-to-paste VPN configurations</p></div></section>
    {error&&<div className="data-warning">{error}</div>}
    {selectedReadiness&&!selectedReadiness.ready&&<div className="data-warning" role="status">RouterOS {routerOsMajor} setup incomplete: {selectedReadiness.missing.join(", ")}</div>}
    <section className="panel vpn-create">
      <h2>Create VPN</h2>
      <form onSubmit={create} className="vpn-form">
        <label>VPN Name<input value={name} onChange={e=>setName(e.target.value)} required minLength="3" placeholder="Branch Router"/></label>
        <label>RouterOS Version<select value={routerOsMajor} onChange={e=>setRouterOsMajor(e.target.value)}>
          <option value="7">RouterOS 7 — WireGuard</option>
          <option value="6">RouterOS 6 — L2TP/IPsec</option>
        </select></label>
        <button className="quick" disabled={loading||selectedReadiness?.ready===false}>{loading?"Creating…":"Create VPN & Script"}</button>
      </form>
    </section>
    {script&&<section className="panel vpn-script">
      <div className="panel-title"><div><h2>One-time MikroTik Script</h2><p>Copy or download now. The private credential is not shown again.</p></div>
        <div><button onClick={()=>navigator.clipboard.writeText(script)}>Copy Script</button><button className="quick" onClick={download}>Download .rsc</button></div>
      </div>
      <pre>{script}</pre>
    </section>}
    <section className="panel"><div className="panel-title"><div><h2>VPN Connections</h2><p>RouterOS version, protocol and synchronization state</p></div>
      <div><button disabled={readiness?.chrSync?.ready===false} onClick={checkChr}>Check CHR</button><button disabled={readiness?.chrSync?.ready===false} onClick={()=>apiSend("/api/admin/vpn/peers/reconcile","POST").then(load).catch(e=>setError(e.message))}>Reconcile</button></div></div>
      {readback&&<p role="status">CHR readback: {readback.length} WireGuard peers; {readback.filter(peer=>peer.lastHandshake).length} report a handshake.</p>}
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>RouterOS</th><th>Protocol</th><th>VPN IP</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{items.map(peer=><tr key={peer.id}><td>{peer.name}</td><td>OS {peer.routerOsMajor}</td><td>{peer.protocol}</td><td>{peer.tunnelIp}</td><td>{peer.status}</td>
       <td>{peer.protocol==="wireguard"&&<><button disabled={readiness?.chrSync?.ready===false} onClick={()=>action(peer.id,"sync")}>Connect</button><button onClick={()=>action(peer.id,"disable")}>Disable</button></>}<button onClick={()=>action(peer.id,"revoke")}>Revoke</button></td>
      </tr>)}</tbody></table></div>
    </section>
  </div>;
}

function ResellersWorkspace({ role }) {
  const [rows,setRows]=useState([]),[name,setName]=useState(""),[username,setUsername]=useState(""),
    [password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const endpoint=role==="Admin"?"/api/admin/resellers":"/api/resellers/sub-resellers";
  const load=()=>apiGet(endpoint).then(response=>setRows(response.data)).catch(e=>setError(e.message));
  useEffect(()=>{load()},[]);
  const submit=async e=>{
    e.preventDefault();setBusy(true);setError("");
    try{
      await apiSend(endpoint,"POST",{name,username,password});
      setName("");setUsername("");setPassword("");
      await load();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  };
  return <div className="content">
    <section className="page-title"><div><h1>Resellers</h1><p>Create accounts with empty tenant wallets.</p></div></section>
    {error&&<div className="data-warning" role="alert">{error}</div>}
    {role!=="Sub-reseller"&&<section className="panel vpn-create"><h2>Add {role==="Admin"?"Reseller":"Sub-reseller"}</h2>
      <form className="vpn-form" onSubmit={submit}>
        <label>Display name<input value={name} onChange={e=>setName(e.target.value)} maxLength="120" required/></label>
        <label>Username<input value={username} onChange={e=>setUsername(e.target.value)} pattern="[A-Za-z_][A-Za-z0-9_.-]{2,62}" required/></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength="12" maxLength="256" autoComplete="new-password" required/></label>
        <button className="quick" disabled={busy}>{busy?"Creating...":role==="Admin"?"Create Reseller":"Create Sub-reseller"}</button>
      </form>
    </section>}
    <section className="panel"><h2>Accounts</h2>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.username}</td><td>{row.role}</td><td>{row.status}</td></tr>)}</tbody></table></div>
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
    [role, setRole] = useState(() => {
      try { return JSON.parse(localStorage.getItem("pppoe_user") || "null")?.role || "Admin"; }
      catch { return "Admin"; }
    });
  useEffect(()=>{
    const syncRole=event=>{setRole(event.detail.role);setActive("Dashboard")};
    window.addEventListener("pppoe:session",syncRole);
    return()=>window.removeEventListener("pppoe:session",syncRole);
  },[]);
  let page =
    active === "Dashboard" ? (
      <Dashboard role={role} />
    ) : active === "Clients" ? (
      <Clients />
    ) : active === "Packages" ? (
      <Packages />
    ) : active === "IP Pools" ? (
      <IpPools />
    ) : active === "Routers / NAS" ? (
      <RouterWorkspace />
    ) : active === "VPN" ? (
      <VpnManagement />
    ) : active === "Resellers" ? (
      <ResellersWorkspace role={role} />
    ) : active === "Wallet & Ledger" ? (
      <WalletWorkspace role={role} />
    ) : active === "Billing" ? (
      <BillingWorkspace />
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
              disabled={Boolean(localStorage.getItem("pppoe_token"))}
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
            <button className="quick" onClick={() => setActive("Billing")}>
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
