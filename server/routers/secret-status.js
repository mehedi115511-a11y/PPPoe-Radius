import { requireRouterOwner, validateRouterId } from './validation.js';

/** Only expose whether credentials exist and their rotation version; never reveal envelopes. */
export async function getRouterSecretStatus(db, actor, routerId) {
  const ownerId = requireRouterOwner(actor);
  const id = validateRouterId(routerId);
  const { rows } = await db.query(`
    SELECT r.id "routerId", s.purpose, s.key_version "keyVersion", s.updated_at "updatedAt"
    FROM app_routers r
    LEFT JOIN app_router_secrets s ON s.router_id=r.id AND s.owner_user_id=r.owner_user_id
    WHERE r.id=$1 AND r.owner_user_id=$2 AND r.deleted_at IS NULL
    ORDER BY s.purpose
  `, [id, ownerId]);
  if (!rows.length) throw Object.assign(new Error('Router not found'), {status:404});
  return {
    routerId:id,
    credentials:rows.filter(row=>row.purpose).map(row=>({purpose:row.purpose,keyVersion:row.keyVersion,updatedAt:row.updatedAt}))
  };
}
