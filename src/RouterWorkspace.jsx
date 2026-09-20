import React, { useEffect, useState } from 'react';

const empty = { name: '', host: '', port: '8729', routerOsVersion: '7', status: 'Disabled' };
async function routerRequest(path, method = 'GET', body) {
  const token = localStorage.getItem('pppoe_token');
  const response = await fetch(path, { method, headers: { Authorization: `Bearer ${token || ''}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
  return result;
}
export default function RouterWorkspace() {
  const [items, setItems] = useState([]), [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState(null);
  async function refresh() {
    try { const result = await routerRequest('/api/routers'); setItems(result.data); setError(''); }
    catch (e) { setError(e.message); }
    finally { setLoaded(true); }
  }
  useEffect(() => { refresh(); }, []);
  const edit = item => { setEditing(item); setCredentialStatus(null); setForm(item ? { name: item.name, host: item.host, port: String(item.port), routerOsVersion: item.routerOsVersion, status: item.status } : empty); setError(''); };
  async function showCredentialStatus(item) {
    setBusy(true); setError(''); setCredentialStatus(null);
    try { const result = await routerRequest(`/api/routers/${item.id}/secrets`); setCredentialStatus({ routerId: item.id, name: item.name, entries: result.data }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await routerRequest(editing ? `/api/routers/${editing.id}` : '/api/routers', editing ? 'PUT' : 'POST', { ...form, port: Number(form.port) }); edit(null); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!editing || !window.confirm(`Remove software router ${editing.name}? This does not change the MikroTik configuration.`)) return;
    setBusy(true); setError('');
    try { await routerRequest(`/api/routers/${editing.id}`, 'DELETE'); edit(null); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="content">
    <section className="page-title"><div><h1>Routers / NAS</h1><p>Tenant router catalog; no device configuration is changed here.</p></div><button className="quick" onClick={() => edit(null)}>Add Router</button></section>
    <section className="panel"><p>Credential status shows stored metadata only, not passwords. Device health is not yet verified.</p></section>
    {error && <div className="data-warning" role="alert">{error}</div>}
    <section className="package-grid">{!loaded ? <p>Loading routers…</p> : !items.length ? <p>No routers registered.</p> : items.map(item => <article key={item.id} className="package-card"><h2>{item.name}</h2><p>{item.host}:{item.port} · RouterOS {item.routerOsVersion}</p><strong>{item.status}</strong><button onClick={() => edit(item)} aria-label={`Edit router ${item.name}`}>Edit</button><button type="button" disabled={busy} onClick={() => showCredentialStatus(item)} aria-label={`Credential status ${item.name}`}>Credential Status</button></article>)}</section>
    {credentialStatus && <section className="panel" aria-label="Credential status"><h2>Stored credentials: {credentialStatus.name}</h2>{credentialStatus.entries.length ? credentialStatus.entries.map(entry => <p key={entry.purpose}>{entry.purpose}: stored (version {entry.keyVersion})</p>) : <p>No credentials stored.</p>}</section>}
    <section className="panel"><h2>{editing ? `Edit ${editing.name}` : 'Add Router'}</h2><form onSubmit={save}><div className="client-form-grid">
      <label>Name<input required maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
      <label>Host<input required maxLength={253} value={form.host} onChange={e => setForm({ ...form, host: e.target.value })}/></label>
      <label>Port<input required type="number" min="1" max="65535" value={form.port} onChange={e => setForm({ ...form, port: e.target.value })}/></label>
      <label>RouterOS<select value={form.routerOsVersion} onChange={e => setForm({ ...form, routerOsVersion: e.target.value })}><option value="6">6</option><option value="7">7</option></select></label>
      <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Disabled</option><option>Active</option></select></label>
    </div><footer><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save Router'}</button>{editing && <button className="danger" type="button" disabled={busy} onClick={remove}>Remove Router</button>}</footer></form></section>
  </div>;
}
