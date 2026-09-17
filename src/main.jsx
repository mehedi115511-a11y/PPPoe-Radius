import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity, Bell, Boxes, ChevronDown, CircleDollarSign, CreditCard, Gauge, Headphones, LayoutDashboard, Menu, Network, Package, RadioTower, ReceiptText, Search, Server, Settings, ShieldCheck, Signal, Users, UserRoundCog, WalletCards, Wifi, X, Zap} from 'lucide-react';
import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell} from 'recharts';
import './styles.css';

const traffic=[{t:'12 AM',up:32,down:65},{t:'4 AM',up:24,down:48},{t:'8 AM',up:45,down:110},{t:'12 PM',up:72,down:162},{t:'4 PM',up:88,down:205},{t:'8 PM',up:96,down:236},{t:'Now',up:78,down:198}];
const plans=[{name:'10 Mbps',value:39,color:'#5b5cf0'},{name:'20 Mbps',value:28,color:'#22c55e'},{name:'30 Mbps',value:19,color:'#06b6d4'},{name:'Others',value:14,color:'#f59e0b'}];
const nav=[
  ['Overview',[['Dashboard',LayoutDashboard],['Live Sessions',Activity]]],
  ['Subscriber',[['All Clients',Users],['PPPoE Accounts',Wifi],['Packages',Package],['IP Pools',Network]]],
  ['Business',[['Resellers',UserRoundCog],['Wallet & Ledger',WalletCards],['Billing',ReceiptText],['Collections',CircleDollarSign]]],
  ['Infrastructure',[['Routers / NAS',Server],['RADIUS Monitor',RadioTower],['Reports',Boxes],['Settings',Settings]]]
];
const stats=[
  {label:'Total Subscribers',value:'12,840',delta:'+3.2%',icon:Users,tone:'violet'},
  {label:'Online Now',value:'8,426',delta:'65.6%',icon:Signal,tone:'cyan'},
  {label:'Active Accounts',value:'11,972',delta:'+168 this month',icon:ShieldCheck,tone:'green'},
  {label:'Expired Accounts',value:'868',delta:'72 grace period',icon:CreditCard,tone:'orange'}
];
const sessions=[
 {user:'saifan-net-1021',ip:'10.22.4.18',plan:'20 Mbps',router:'Dhaka-Core-01',time:'06h 42m',down:'18.6 Mbps',status:'Online'},
 {user:'rahim-home-77',ip:'10.23.8.201',plan:'10 Mbps',router:'Gazipur-NAS-02',time:'02h 18m',down:'8.9 Mbps',status:'Online'},
 {user:'hasan-office-12',ip:'10.24.1.94',plan:'30 Mbps',router:'Narayanganj-01',time:'11h 09m',down:'27.2 Mbps',status:'Online'},
 {user:'mim-enterprise',ip:'10.22.9.11',plan:'50 Mbps',router:'Dhaka-Core-01',time:'01h 31m',down:'42.5 Mbps',status:'Online'}
];

function App(){
 const [open,setOpen]=useState(false); const [active,setActive]=useState('Dashboard');
 return <div className="app">
  <aside className={open?'sidebar open':'sidebar'}>
   <div className="brand"><div className="brand-mark"><RadioTower/></div><div><b>PPPoE</b><span>RADIUS INTEGRATION</span></div><button className="side-close" onClick={()=>setOpen(false)}><X/></button></div>
   <div className="tenant"><div className="tenant-icon">NG</div><div><small>Current ISP</small><strong>NextGan Networks</strong></div><ChevronDown/></div>
   <nav>{nav.map(([group,items])=><div className="nav-group" key={group}><p>{group}</p>{items.map(([name,Icon])=><button key={name} className={active===name?'active':''} onClick={()=>{setActive(name);setOpen(false)}}><Icon/><span>{name}</span>{name==='Live Sessions'&&<em>8.4k</em>}</button>)}</div>)}</nav>
   <div className="support"><Headphones/><div><b>Need assistance?</b><span>24/7 Network Support</span></div></div>
   <div className="profile"><div className="avatar">SI</div><div><b>Saifan Islam</b><span>Super Administrator</span></div><button><Settings/></button></div>
  </aside>
  {open&&<div className="scrim" onClick={()=>setOpen(false)}/>}
  <main>
   <header><button className="menu" onClick={()=>setOpen(true)}><Menu/></button><div className="search"><Search/><input placeholder="Search subscribers, routers, invoices..."/></div><div className="head-actions"><div className="live"><i/>RADIUS Live</div><button className="icon-btn"><Bell/><span>3</span></button><button className="quick"><Zap/>Quick Recharge</button></div></header>
   <div className="content">
    <section className="welcome"><div><p>THURSDAY, 17 SEPTEMBER</p><h1>Network Command Center</h1><span>Real-time operations overview for NextGan Networks</span></div><div className="period"><button className="selected">Today</button><button>7 days</button><button>30 days</button></div></section>
    <section className="stats">{stats.map(({label,value,delta,icon:Icon,tone})=><article className={`stat ${tone}`} key={label}><div className="stat-top"><span className="stat-icon"><Icon/></span><b>{delta}</b></div><strong>{value}</strong><p>{label}</p></article>)}</section>
    <section className="grid-main">
     <article className="panel traffic"><div className="panel-head"><div><h2>Network Traffic</h2><p>Aggregate throughput across all online NAS</p></div><div className="legend"><span><i className="download"/>Download</span><span><i className="upload"/>Upload</span></div></div><div className="traffic-total"><div><b>198.4</b><span>Mbps download</span></div><div><b>78.2</b><span>Mbps upload</span></div><div><b>2.84</b><span>TB today</span></div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={traffic}><defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b5cf0" stopOpacity={.42}/><stop offset="100%" stopColor="#5b5cf0" stopOpacity={0}/></linearGradient><linearGradient id="u" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={.28}/><stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 6" vertical={false}/><XAxis dataKey="t" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Area type="monotone" dataKey="down" stroke="#5b5cf0" strokeWidth={3} fill="url(#d)"/><Area type="monotone" dataKey="up" stroke="#06b6d4" strokeWidth={3} fill="url(#u)"/></AreaChart></ResponsiveContainer></div></article>
     <article className="panel health"><div className="panel-head"><div><h2>Infrastructure Health</h2><p>Live service availability</p></div><button>View all</button></div><div className="health-score"><div className="ring"><b>98.7%</b><span>Healthy</span></div></div><div className="health-list"><div><span><Server/>Routers / NAS</span><b className="ok">24 / 25</b></div><div><span><RadioTower/>RADIUS nodes</span><b className="ok">2 / 2</b></div><div><span><Gauge/>Average latency</span><b>18 ms</b></div><div><span><Activity/>Auth success</span><b className="ok">99.4%</b></div></div></article>
    </section>
    <section className="grid-bottom">
     <article className="panel"><div className="panel-head"><div><h2>Package Distribution</h2><p>Active subscribers by plan</p></div><button>Manage</button></div><div className="plans"><div className="pie"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={plans} innerRadius={55} outerRadius={78} paddingAngle={4} dataKey="value">{plans.map(x=><Cell key={x.name} fill={x.color}/>)}</Pie></PieChart></ResponsiveContainer><div><b>11,972</b><span>Active</span></div></div><div className="plan-list">{plans.map(x=><div key={x.name}><span><i style={{background:x.color}}/>{x.name}</span><b>{x.value}%</b></div>)}</div></div></article>
     <article className="panel finance"><div className="panel-head"><div><h2>Revenue Pulse</h2><p>September collection</p></div><button>Finance</button></div><div className="revenue"><span>Collected</span><b>৳ 24,82,450</b><p><strong>78%</strong> of ৳31.8L target</p><div className="bar"><i/></div></div><div className="money-grid"><div><span>Due</span><b>৳6.95L</b></div><div><span>Today</span><b>৳1.28L</b></div><div><span>Reseller balance</span><b>৳4.16L</b></div></div></article>
     <article className="panel alerts"><div className="panel-head"><div><h2>Attention Required</h2><p>Operational alerts</p></div><button>View all</button></div><div className="alert-item danger"><span><Server/></span><div><b>Gazipur-NAS-03 offline</b><p>Unreachable for 18 minutes</p></div><em>Critical</em></div><div className="alert-item warning"><span><CreditCard/></span><div><b>72 accounts in grace period</b><p>Will expire within 24 hours</p></div><em>Review</em></div><div className="alert-item info"><span><WalletCards/></span><div><b>3 reseller wallets low</b><p>Below minimum balance</p></div><em>Notice</em></div></article>
    </section>
    <section className="panel sessions"><div className="panel-head"><div><h2>Live PPPoE Sessions</h2><p>Latest authenticated connections</p></div><button>Open live monitor</button></div><div className="table-wrap"><table><thead><tr><th>Subscriber</th><th>IP address</th><th>Package</th><th>Router / NAS</th><th>Session</th><th>Download</th><th>Status</th></tr></thead><tbody>{sessions.map(s=><tr key={s.user}><td><b>{s.user}</b></td><td>{s.ip}</td><td><span className="plan-pill">{s.plan}</span></td><td>{s.router}</td><td>{s.time}</td><td>{s.down}</td><td><span className="online"><i/>{s.status}</span></td></tr>)}</tbody></table></div></section>
   </div>
  </main>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
