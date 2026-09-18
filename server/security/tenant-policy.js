const validId = (id) => (typeof id === "number" && Number.isSafeInteger(id) && id > 0) || (typeof id === "string" && /^[1-9][0-9]*$/.test(id) && Number.isSafeInteger(Number(id)));
export function canAccessOwner(actor, ownerUserId) {
  if (!actor || !validId(actor.id)) return false;
  if (actor.status !== "Active") return false;
  if (actor.role === "Admin" && !actor.impersonatedBy) return true;
  if (!validId(ownerUserId)) return false;
  return Number(actor.id) === Number(ownerUserId);
}
export function canManageUser(actor, target) {
  if (!actor || !target || !validId(actor.id) || !validId(target.id) || actor.status !== "Active") return false;
  if (actor.role === "Admin" && !actor.impersonatedBy) return true;
  return actor.role === "Reseller" && target.role === "Sub-reseller" && validId(target.parent_user_id) && Number(target.parent_user_id) === Number(actor.id);
}
