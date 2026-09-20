import { requireRouterOwner, validateRouterId } from './validation.js';
import { encryptRouterSecret } from './secret-crypto.js';

const rejected = (message, status) => Object.assign(new Error(message), { status });
const purposes = new Set(['router-api', 'radius-shared-secret']);

/** Stores ciphertext only. Never returns plaintext or ciphertext to HTTP callers. */
export async function saveRouterSecret(db, actor, routerId, purpose, secret, keyHex) {
  const ownerId = requireRouterOwner(actor);
  const id = validateRouterId(routerId);
  if (!purposes.has(purpose)) throw rejected('Unsupported router secret type', 422);
  if (typeof secret !== 'string' || secret.length < 8 || Buffer.byteLength(secret, 'utf8') > 1024) {
    throw rejected('Invalid router secret length', 422);
  }
  if (typeof keyHex !== 'string' || !/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw rejected('Router secret encryption is unavailable', 503);
  }
  const encrypted = encryptRouterSecret(secret, { keyHex, ownerId, routerId: id, purpose });
  const { rows } = await db.query(`
    INSERT INTO app_router_secrets(router_id,owner_user_id,purpose,encrypted_value)
    SELECT id,owner_user_id,$3,$4 FROM app_routers
    WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL AND status='Disabled'
    ON CONFLICT (router_id,purpose) DO UPDATE
      SET encrypted_value=EXCLUDED.encrypted_value, key_version=app_router_secrets.key_version+1, updated_at=now()
    RETURNING router_id "routerId",purpose,key_version "keyVersion",updated_at "updatedAt"
  `, [id, ownerId, purpose, encrypted]);
  if (!rows[0]) throw rejected('Router not found or must be disabled before credential changes', 409);
  return rows[0];
}
