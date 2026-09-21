import React, { useEffect, useState } from 'react';
import RouterAssignmentForm from './RouterAssignmentForm.jsx';
const empty={name:'',host:'',port:'443',routerOsVersion:'7',status:'Disabled'};
async function routerRequest(path,method='GET',body){const token=localStorage.getItem('pppoe_token');const response=await fetch(path,{method,headers:{Authorization:`Bearer ${token||''}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const result=response.status===204?null:await response.json();if(!response.ok)throw new Error(result?.error||`HTTP ${response.status}`);return result}
export default function RouterWorkspace(){
 const [items,setItems]=useState([]),[editing,setEditing]=useState(null),[form,setForm]=useState(empty),[error,setError]=useState('');
 const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[credentialStatus,setCredentialStatus]=useState(null),[dependencies,setDependencies]=useState(null);
 const [assignmentRouter,setAssignmentRouter]=useState(null),[assignmentNotice,setAssignmentNotice]=useState(''),[credentialRouter,setCredentialRouter]=useState(null);
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[health,setHealth]=useState(null);
 async function refresh(){try{const result=await routerRequest('/api/routers');setItems(result.data);setError('')}catch(e){setError(e.message)}finally{setLoaded(true)}}
 useEffect(()=>{refresh()},[]);
 const clearPanels=()=>{setCredentialStatus(null);setDependencies(null);setAssignmentRouter(null);setCredentialRouter(null);setHealth(null)};
 const edit=item=>{setEditing(item);clearPanels();setAssignmentNotice('');setForm(item?{name:item.name,host:item.host,port:String(item.port),routerOsVersion:item.routerOsVersion,status:item.status}:empty);setError('')};
 async function showCredentialStatus(item){setBusy(true);setError('');clearPanels();try{const result=await routerRequest(`/api/routers/${item.id}/secrets`);setCredentialStatus({routerId:item.id,name:item.name,entries:result.data.credentials})}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function showDependencies(item){setBusy(true);setError('');clearPanels();try{const result=await routerRequest(`/api/routers/${item.id}/dependencies`);setDependencies({...result.data,name:item.name})}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function assignRecord(routerId,body){setBusy(true);setError('');setAssignmentNotice('');try{await routerRequest(`/api/routers/${routerId}/assignments`,'POST',body);setAssignmentNotice(`${body.kind==='client'?'Client':'Package'} ${body.recordId} assigned.`);return true}catch(e){setError(e.message);return false}finally{setBusy(false)}}
 async function saveCredential(event){event.preventDefault();setBusy(true);setError('');try{await routerRequest(`/api/routers/${credentialRouter.id}/secrets/router-api`,'PUT',{secret:JSON.stringify({username,password})});setUsername('');setPassword('');setAssignmentNotice(`Encrypted RouterOS credential stored for ${credentialRouter.name}.`)}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function revokeCredential(){setBusy(true);setError('');try{await routerRequest(`/api/routers/${credentialRouter.id}/secrets/router-api`,'DELETE');setAssignmentNotice(`RouterOS credential revoked for ${credentialRouter.name}.`);setCredentialRouter(null)}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function checkHealth(item){setBusy(true);setError('');setHealth(null);try{const result=await routerRequest(`/api/routers/${item.id}/health`,'POST');setHealth({...result.data,name:item.name})}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function save(event){event.preventDefault();setBusy(true);setError('');try{await routerRequest(editing?`/api/routers/${editing.id}`:'/api/routers',editing?'PUT':'POST',{...form,port:Number(form.port)});edit(null);await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function remove(){if(!editing||!window.confirm(`Remove software router ${editing.name}? Stored credentials will be revoked; MikroTik configuration is unchanged.`))return;setBusy(true);setError('');try{await routerRequest(`/api/routers/${editing.id}`,'DELETE');edit(null);await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="content">
  <section className="page-title"><div><h1>Routers / NAS</h1><p>Tenant RouterOS catalog, encrypted credentials and read-only health.</p></div><button className="quick" onClick={()=>edit(null)}>Add Router</button></section>
  <section className="panel"><p>Health uses RouterOS HTTPS REST and never displays stored passwords. Removing a router is allowed only after every tenant client/package is explicitly reconciled and unlinked.</p></section>
  {error&&<div className="data-warning" role="alert">{error}</div>}{assignmentNotice&&<p role="status">{assignmentNotice}</p>}
  <section className="package-grid">{!loaded?<p>Loading routers...</p>:!items.length?<p>No routers registered.</p>:items.map(item=><article key={item.id} className="package-card"><h2>{item.name}</h2><p>{item.host}:{item.port} · RouterOS {item.routerOsVersion}</p><strong>{item.status}</strong>
   <button onClick={()=>edit(item)} aria-label={`Edit router ${item.name}`}>Edit</button>
   <button disabled={busy} onClick={()=>showCredentialStatus(item)} aria-label={`Credential status ${item.name}`}>Credential Status</button>
   <button disabled={busy} onClick={()=>{clearPanels();setCredentialRouter(item)}} aria-label={`Manage credential ${item.name}`}>Manage Credential</button>
   <button disabled={busy} onClick={()=>checkHealth(item)} aria-label={`Check health ${item.name}`}>Check Health</button>
   <button disabled={busy} onClick={()=>showDependencies(item)} aria-label={`Dependencies ${item.name}`}>Dependencies</button>
   <button disabled={busy} onClick={()=>{clearPanels();setAssignmentRouter(item);setAssignmentNotice('');setError('')}} aria-label={`Assign records to ${item.name}`}>Assign records</button>
  </article>)}</section>
  {health&&<section className="panel" aria-label="Router health"><h2>Router health: {health.name}</h2><p>Authenticated: Yes · RouterOS {health.version||health.routerOsVersion} · Uptime {health.uptime||'not reported'} · {health.latencyMs} ms</p></section>}
  {credentialStatus&&<section className="panel" aria-label="Credential status"><h2>Stored credentials: {credentialStatus.name}</h2>{credentialStatus.entries.length?credentialStatus.entries.map(entry=><p key={entry.purpose}>{entry.purpose}: stored (version {entry.keyVersion})</p>):<p>No credentials stored.</p>}</section>}
  {credentialRouter&&<section className="panel"><h2>RouterOS credential: {credentialRouter.name}</h2><form onSubmit={saveCredential}><div className="client-form-grid"><label>API Username<input required autoComplete="off" value={username} onChange={e=>setUsername(e.target.value)}/></label><label>API Password<input required type="password" autoComplete="new-password" minLength="8" value={password} onChange={e=>setPassword(e.target.value)}/></label></div><footer><button className="primary" disabled={busy}>Encrypt & Save</button><button type="button" className="danger" disabled={busy} onClick={revokeCredential}>Revoke Credential</button></footer></form></section>}
  {dependencies&&<section className="panel" aria-label="Router dependencies"><h2>Router dependencies: {dependencies.name}</h2><p>Linked clients: {dependencies.clients} · Linked packages: {dependencies.packages} · Stored credentials: {dependencies.credentials}</p><p>Unmapped tenant clients: {dependencies.unmappedClients} · Unmapped tenant packages: {dependencies.unmappedPackages}</p><p role="status">{dependencies.removalAvailable?'Removal ready':'Removal unavailable'}: {dependencies.reason}</p></section>}
  <RouterAssignmentForm router={assignmentRouter} busy={busy} onAssign={assignRecord}/>
  <section className="panel"><h2>{editing?`Edit ${editing.name}`:'Add Router'}</h2><form onSubmit={save}><div className="client-form-grid">
   <label>Name<input required maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   <label>Host<input required maxLength={253} value={form.host} onChange={e=>setForm({...form,host:e.target.value})}/></label>
   <label>RouterOS HTTPS Port<input required type="number" min="1" max="65535" value={form.port} onChange={e=>setForm({...form,port:e.target.value})}/></label>
   <label>RouterOS<select value={form.routerOsVersion} onChange={e=>setForm({...form,routerOsVersion:e.target.value})}><option value="6">6</option><option value="7">7</option></select></label>
   <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Disabled</option><option>Active</option></select></label>
  </div><footer><button className="primary" disabled={busy}>{busy?'Saving...':'Save Router'}</button>{editing&&<button className="danger" type="button" disabled={busy} onClick={remove}>Remove Router</button>}</footer></form></section>
 </div>
}
