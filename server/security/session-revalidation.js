import { canAccessOwner } from './tenant-policy.js';

// JWT claims identify a session; current database state is authoritative for access.
export async function revalidateSession(db, claims) {
  if (!claims || !canAccessOwner({ id: claims.id, status: 'Active', role: 'Reseller' }, claims.id)) throw new Error('Invalid session identity');
  const { rows } = await db.query('select id,name,username,role,status from app_users where id=$1', [claims.id]);
  const user = rows[0];
  if (!user || user.status !== 'Active' || user.role !== claims.role || user.username !== claims.username) throw new Error('Session revoked');
  if (!claims.impersonatedBy) return { id: user.id, name: user.name, username: user.username, role: user.role, status: user.status };
  const impersonator = claims.impersonatedBy;
  if (user.role === 'Admin' || !canAccessOwner({ id: impersonator.id, status: 'Active', role: 'Reseller' }, impersonator.id)) throw new Error('Invalid impersonation');
  const result = await db.query('select id,name,username,role,status from app_users where id=$1', [impersonator.id]);
  const admin = result.rows[0];
  if (!admin || admin.role !== 'Admin' || admin.status !== 'Active' || admin.username !== impersonator.username) throw new Error('Impersonation revoked');
  return { id: user.id, name: user.name, username: user.username, role: user.role, status: user.status, impersonatedBy: { id: admin.id, name: admin.name, username: admin.username } };
}
