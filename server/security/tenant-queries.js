import { canAccessOwner } from './tenant-policy.js';

// A legacy NULL owner is never visible, including to administrators, until reconciled.
export function tenantScope(actor, alias = '', parameterIndex = 1) {
  if (!actor || actor.status !== 'Active' || !/^[a-z_]*$/.test(alias) || !Number.isSafeInteger(parameterIndex) || parameterIndex < 1) throw new Error('Unauthorized tenant scope');
  // An impersonated administrator must not silently gain the administrator-wide scope.
  if (actor.role === 'Admin' && actor.impersonatedBy) throw new Error('Unauthorized tenant scope');
  const column = alias ? `${alias}.owner_user_id` : 'owner_user_id';
  if (actor.role === 'Admin') return { sql: `${column} IS NOT NULL`, params: [] };
  if (!canAccessOwner(actor, actor.id)) throw new Error('Unauthorized tenant scope');
  return { sql: `${column} = $${parameterIndex}`, params: [actor.id] };
}

export async function resolveTenantPackage(db, actor, packageId) {
  if (!Number.isSafeInteger(Number(packageId)) || Number(packageId) <= 0 || !/^[1-9][0-9]*$/.test(String(packageId))) return null;
  const scope = tenantScope(actor);
  const parameter = scope.params.length + 1;
  const result = await db.query(
    `SELECT id, owner_user_id, name, download_mbps, upload_mbps, price FROM app_packages WHERE ${scope.sql} AND id=$${parameter} AND status='Active'`,
    [...scope.params, packageId],
  );
  return result.rows[0] || null;
}

export function requireReconciledOwner(actor, ownerId) {
  return ownerId != null && canAccessOwner(actor, ownerId);
}
