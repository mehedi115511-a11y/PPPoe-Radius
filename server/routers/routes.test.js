import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { registerRouterRoutes } from './routes.js';

const actor = { id: 11, role: 'Admin', status: 'Active' };
function fixture(authenticated = true) {
  const app = express(); app.use(express.json());
  const db = { query: vi.fn(async (sql) => ({ rows: sql.startsWith('SELECT') ? (sql.includes('WHERE id=$1') ? [{ id: 7 }] : []) : [{ id: 7, name: 'Router A' }] })) };
  const client = { query: vi.fn(async (sql) => sql.includes('SELECT r.id') ? { rows: [{ id:7,clients:0,packages:0,unmappedClients:0,unmappedPackages:0 }] } : { rows:[] }), release: vi.fn() };
  db.connect = vi.fn(async () => client);
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
  it('removes an unreferenced router transactionally', async () => { const { app, db } = fixture(); const r = await request(app, 'DELETE', '/api/routers/7'); expect(r.status).toBe(204); expect(db.connect).toHaveBeenCalledTimes(1); });
  it('rejects malformed IDs before querying DB', async () => { const { app, db } = fixture(); const r = await request(app, 'DELETE', '/api/routers/invalid'); expect(r.status).toBe(422); expect(db.query).not.toHaveBeenCalled(); });
  it('requires authentication middleware at registration', () => { expect(() => registerRouterRoutes(express(), {}, null)).toThrow(/authentication/); });
});

describe("Router assignment HTTP boundary", () => {
  it("requires authentication before attempting assignment", async () => {
    const { app, db } = fixture(false);
    const result = await request(app, "POST", "/api/routers/7/assignments", { kind: "client", recordId: "5" });
    expect(result.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });
  it("returns successful assignment with no-store and tenant-scoped SQL", async () => {
    const { app, db } = fixture();
    const result = await request(app, "POST", "/api/routers/7/assignments", { kind: "client", recordId: "5" });
    expect(result.status).toBe(200);
    expect(result.cache).toBe("no-store");
    expect(result.body.data).toEqual({ routerId: 7, kind: "client", recordId: 5, assigned: true });
    expect(db.query.mock.calls[0][1]).toEqual([7, 5, 11]);
  });
  it("rejects invalid payload without touching database", async () => {
    const { app, db } = fixture();
    const result = await request(app, "POST", "/api/routers/7/assignments", { kind: "client", recordId: "5", owner: 12 });
    expect(result.status).toBe(422);
    expect(db.query).not.toHaveBeenCalled();
  });
});
