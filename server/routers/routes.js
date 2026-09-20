import { listRouters, createRouter, updateRouter, deleteRouter } from './catalog.js';
import { saveRouterSecret } from './secret-store.js';
import { revokeRouterSecret } from './secret-revoke.js';

/** Mount under /api; authentication must run before every route. */
export function registerRouterRoutes(app, db, authenticate) {
  if (typeof authenticate !== 'function') throw new Error('Router routes require authentication');
  const execute = (operation, status = 200) => async (req, res, next) => {
    try {
      const data = await operation(req);
      res.set('Cache-Control', 'no-store');
      if (status === 204) return res.status(204).end();
      return res.status(status).json({ data, ...(Array.isArray(data) ? { count: data.length } : {}) });
    } catch (error) { next(error); }
  };
  app.get('/api/routers', authenticate, execute((req) => listRouters(db, req.auth)));
  app.post('/api/routers', authenticate, execute((req) => createRouter(db, req.auth, req.body), 201));
  app.put('/api/routers/:id', authenticate, execute((req) => updateRouter(db, req.auth, req.params.id, req.body)));
  app.put('/api/routers/:id/secrets/:purpose', authenticate, execute((req) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'secret')) {
      throw Object.assign(new Error('Only a secret value is accepted'), { status: 422 });
    }
    return saveRouterSecret(db, req.auth, req.params.id, req.params.purpose, body.secret, process.env.ROUTER_SECRET_KEY_HEX);
  }));
  app.delete('/api/routers/:id/secrets/:purpose', authenticate, execute((req) => revokeRouterSecret(db, req.auth, req.params.id, req.params.purpose), 204));
  app.delete('/api/routers/:id', authenticate, execute((req) => deleteRouter(db, req.auth, req.params.id), 204));
}
