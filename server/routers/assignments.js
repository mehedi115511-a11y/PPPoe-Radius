import { requireRouterOwner, validateRouterId } from './validation.js';

/** Assign only an explicitly identified, still-unmapped record. Never infer from names/hosts. */
export async function assignRouterRecord(db, actor, routerId, body) {
  const owner = requireRouterOwner(actor);
  const id = validateRouterId(routerId);
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'kind,recordId' ||
      !['client', 'package'].includes(body.kind)) {
    throw Object.assign(new Error('Specify kind and recordId explicitly'), { status: 422 });
  }
  const recordId = validateRouterId(body.recordId);
  const table = body.kind === 'client' ? 'app_clients' : 'app_packages';
  // Table name comes exclusively from the fixed allowlist above, never user SQL.
  const { rows } = await db.query(`UPDATE ${table} AS item SET router_id=$1
    WHERE item.id=$2 AND item.owner_user_id=$3 AND item.router_id IS NULL
      AND EXISTS (SELECT 1 FROM app_routers AS r WHERE r.id=$1
        AND r.owner_user_id=$3 AND r.deleted_at IS NULL)
    RETURNING item.id`, [id, recordId, owner]);
  if (!rows[0]) throw Object.assign(new Error('Assignment unavailable: verify tenant ownership, router and unmapped record'), { status: 409 });
  return { routerId: id, kind: body.kind, recordId, assigned: true };
}
