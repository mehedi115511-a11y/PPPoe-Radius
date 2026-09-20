import { listRouters, createRouter, updateRouter, deleteRouter } from './catalog.js';

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
  app.delete('/api/routers/:id', authenticate, execute((req) => deleteRouter(db, req.auth, req.params.id), 204));
}
