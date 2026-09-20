import { requireRouterOwner, validateRouterId } from './validation.js';

/** Read-only and fail-closed: legacy NULL router identities are unresolved, not free of dependencies. */
export async function getRouterDependencies(db, actor, routerId) {
  const owner = requireRouterOwner(actor);
  const id = validateRouterId(routerId);
  const { rows } = await db.query(`
    SELECT r.id "routerId", r.status,
      (SELECT count(*)::int FROM app_clients c WHERE c.owner_user_id=r.owner_user_id AND c.router_id=r.id) "clients",
      (SELECT count(*)::int FROM app_packages p WHERE p.owner_user_id=r.owner_user_id AND p.router_id=r.id) "packages",
      (SELECT count(*)::int FROM app_clients c WHERE c.owner_user_id=r.owner_user_id AND c.router_id IS NULL) "unmappedClients",
      (SELECT count(*)::int FROM app_packages p WHERE p.owner_user_id=r.owner_user_id AND p.router_id IS NULL) "unmappedPackages",
      (SELECT count(*)::int FROM app_router_secrets s WHERE s.owner_user_id=r.owner_user_id AND s.router_id=r.id) "credentials"
    FROM app_routers r WHERE r.id=$1 AND r.owner_user_id=$2 AND r.deleted_at IS NULL
  `, [id, owner]);
  if (!rows[0]) throw Object.assign(new Error('Router not found'), { status:404 });
  const {status,clients,packages,unmappedClients,unmappedPackages,credentials} = rows[0];
  return {routerId:id, status, clients, packages, unmappedClients, unmappedPackages, credentials,
    removalAvailable:false, reason:'Router removal remains disabled until legacy identities and concurrent writes are reconciled'};
}
