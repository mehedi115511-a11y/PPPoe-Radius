import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { registerRouterRoutes } from './routes.js';

const actor = { id: 11, role: 'Admin', status: 'Active' };
function fixture(authenticated = true) {
  const app = express(); app.use(express.json());
  const db = { query: vi.fn(async (sql) => ({ rows: sql.startsWith('SELECT') ? [] : [{ id: 7, name: 'Router A' }] })) };
  const auth = (req, res, next) => authenticated ? (req.auth = actor, next()) : res.status(401).json({ error: 'Authentication required' });
  registerRouterRoutes(app, db, auth);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  return { app, db };
}
async function request(app, method, path, body) {
  const server = app.listen(0);
  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, cache: response.headers.get('cache-control'), body: response.status === 204 ? null : await response.json() };
  } finally { await new Promise((resolve) => server.close(resolve)); }
}
describe('Router/NAS HTTP routes', () => {
  it('rejects unauthenticated catalog reads before querying DB', async () => { const { app, db } = fixture(false); expect((await request(app, 'GET', '/api/routers')).status).toBe(401); expect(db.query).not.toHaveBeenCalled(); });
  it('lists only the actor-owned catalog with no-store', async () => { const { app, db } = fixture(); const r = await request(app, 'GET', '/api/routers'); expect(r.status).toBe(200); expect(r.body).toEqual({ data: [], count: 0 }); expect(r.cache).toBe('no-store'); expect(db.query.mock.calls[0][1]).toEqual([11]); });
  it('rejects unknown fields without querying DB', async () => { const { app, db } = fixture(); const r = await request(app, 'POST', '/api/routers', { name: 'A', host: '192.0.2.1', password: 'must-not-accept' }); expect(r.status).toBe(422); expect(db.query).not.toHaveBeenCalled(); });
  it('soft-deletes owned router with 204 response', async () => { const { app, db } = fixture(); const r = await request(app, 'DELETE', '/api/routers/7'); expect(r.status).toBe(204); expect(r.body).toBeNull(); expect(db.query.mock.calls[0][1]).toEqual([7, 11]); });
  it('rejects malformed IDs before querying DB', async () => { const { app, db } = fixture(); const r = await request(app, 'DELETE', '/api/routers/invalid'); expect(r.status).toBe(422); expect(db.query).not.toHaveBeenCalled(); });
  it('requires authentication middleware at registration', () => { expect(() => registerRouterRoutes(express(), {}, null)).toThrow(/authentication/); });
});
