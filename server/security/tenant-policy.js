export function canAccessOwner(actor, ownerUserId) {
  if (!actor || !Number.isSafeInteger(Number(actor.id))) return false;
  if (actor.status !== "Active") return false;
  if (actor.role === "Admin" && !actor.impersonatedBy) return true;
  if (ownerUserId == null) return false;
  return Number(actor.id) === Number(ownerUserId);
}
export function canManageUser(actor, target) {
  if (!actor || !target || actor.status !== "Active") return false;
  if (actor.role === "Admin" && !actor.impersonatedBy) return true;
  return actor.role === "Reseller" && target.role === "Sub-reseller" && Number(target.parent_user_id) === Number(actor.id);
}
