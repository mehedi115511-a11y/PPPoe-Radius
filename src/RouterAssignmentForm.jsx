import React, { useState } from 'react';

/** Manual reconciliation only: never infer identities from router names or addresses. */
export default function RouterAssignmentForm({ router, busy, onAssign }) {
  const [kind, setKind] = useState('client');
  const [recordId, setRecordId] = useState('');
  if (!router) return null;
  async function submit(event) {
    event.preventDefault();
    if (!/^[1-9]\d*$/.test(recordId)) return;
    const assigned = await onAssign(router.id, { kind, recordId });
    if (assigned) setRecordId('');
  }
  return <section className="panel" aria-label="Manual router assignment">
    <h2>Assign an existing record to {router.name}</h2>
    <p>Use the verified database record ID. Names, IP addresses and matching labels are never used to infer ownership. Only unassigned records belonging to your tenant can be assigned.</p>
    <form onSubmit={submit}>
      <div className="client-form-grid">
        <label>Record type<select value={kind} disabled={busy} onChange={e => setKind(e.target.value)}><option value="client">Client</option><option value="package">Package</option></select></label>
        <label>Exact record ID<input required inputMode="numeric" pattern="[1-9][0-9]*" value={recordId} disabled={busy} onChange={e => setRecordId(e.target.value)} /></label>
      </div>
      <button className="primary" type="submit" disabled={busy || !/^[1-9]\d*$/.test(recordId)}>Assign record</button>
    </form>
  </section>;
}
