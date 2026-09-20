import { requireRouterOwner, validateRouterId } from './validation.js';

/** Revoke only a stored software credential; never modifies RADIUS or MikroTik devices. */
export async function revokeRouterSecret(db, actor, routerId, purpose) {
  const owner = requireRouterOwner(actor);
  const id = validateRouterId(routerId);
  if (!['router-api', 'radius-shared-secret'].includes(purpose)) {
    throw Object.assign(new Error('Unsupported router secret type'), { status: 422 });
  }
  const { rows } = await db.query(`
    DELETE FROM app_router_secrets s USING app_routers r
    WHERE s.router_id=$1 AND s.owner_user_id=$2 AND s.purpose=$3
      AND r.id=s.router_id AND r.owner_user_id=s.owner_user_id
      AND r.deleted_at IS NULL AND r.status='Disabled'
    RETURNING s.router_id "routerId", s.purpose
  `, [id, owner, purpose]);
  if (!rows[0]) throw Object.assign(new Error('Credential not found or router must be disabled'), { status: 409 });
  return rows[0];
}
