import { describe, it, expect, vi } from 'vitest';
import { saveRouterSecret } from './secret-store.js';
import { decryptRouterSecret } from './secret-crypto.js';
const keyHex = 'ab'.repeat(32);
const actor = { id: 12, role: 'Admin', status: 'Active' };
const dbWith = rows => ({ query: vi.fn().mockResolvedValue({ rows }) });
describe('Router/NAS encrypted credential storage', () => {
  it('stores ciphertext through an owner-scoped, disabled-router query and returns metadata only', async () => {
    const db = dbWith([{ routerId: 4, purpose: 'router-api', keyVersion: 1 }]);
    const result = await saveRouterSecret(db, actor, '4', 'router-api', 'test-password-123', keyHex);
    expect(result).toEqual({ routerId: 4, purpose: 'router-api', keyVersion: 1 });
    const [sql, args] = db.query.mock.calls[0];
    expect(sql).toMatch(/owner_user_id=\$2/);
    expect(sql).toMatch(/status='Disabled'/);
    expect(sql).toMatch(/ON CONFLICT \(router_id,purpose\)/);
    expect(args.slice(0,3)).toEqual([4,12,'router-api']);
    expect(args[3]).not.toContain('test-password-123');
    expect(decryptRouterSecret(args[3], { keyHex, ownerId:12, routerId:4, purpose:'router-api' })).toBe('test-password-123');
    expect(JSON.stringify(result)).not.toContain('test-password-123');
  });
  it('rejects missing key, unsupported purpose and short secrets without DB access', async () => {
    const db = {query:vi.fn()};
    await expect(saveRouterSecret(db,actor,'4','router-api','test-password-123',undefined)).rejects.toMatchObject({status:503});
    await expect(saveRouterSecret(db,actor,'4','other','test-password-123',keyHex)).rejects.toMatchObject({status:422});
    await expect(saveRouterSecret(db,actor,'4','router-api','short',keyHex)).rejects.toMatchObject({status:422});
    expect(db.query).not.toHaveBeenCalled();
  });
  it('does not write when owned and disabled router is unavailable', async () => {
    const db=dbWith([]);
    await expect(saveRouterSecret(db,actor,'4','radius-shared-secret','test-secret-123',keyHex)).rejects.toMatchObject({status:409});
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
