import { describe, expect, it, vi } from "vitest";
import { postWalletTransfer, walletRequestFingerprint } from "./wallet-store.js";

const base = {
  tenantOwnerUserId: 2,
  actor: { userId: 2, role: "Reseller", status: "Active" },
  operation: "recharge",
  idempotencyKey: "recharge-1001",
  sourceReference: "bill-1001",
  debitOwnerUserId: 2,
  creditOwnerUserId: 3,
  amount: "500.00",
};

describe("wallet request identity", () => {
  it("is deterministic and binds financial semantics", () => {
    expect(walletRequestFingerprint(base)).toBe(walletRequestFingerprint({ ...base }));
    expect(walletRequestFingerprint({ ...base, amount: "500.01" })).not.toBe(walletRequestFingerprint(base));
    expect(walletRequestFingerprint({ ...base, creditOwnerUserId: 4 })).not.toBe(walletRequestFingerprint(base));
  });

  it("rejects malformed identifiers and numeric amounts", () => {
    expect(() => walletRequestFingerprint({ ...base, idempotencyKey: "bad key" })).toThrow();
    expect(() => walletRequestFingerprint({ ...base, amount: 500 })).toThrow();
    expect(() => walletRequestFingerprint({ ...base, tenantOwnerUserId: 0 })).toThrow();
  });
});

describe("wallet transfer fail-closed preflight", () => {
  it("denies suspended, impersonated and cross-tenant actors before DB access", async () => {
    const pool = { connect: vi.fn() };
    await expect(postWalletTransfer(pool, { ...base, actor: { ...base.actor, status: "Suspended" } })).rejects.toThrow();
    await expect(postWalletTransfer(pool, { ...base, actor: { ...base.actor, impersonatedBy: { id: 1 } } })).rejects.toThrow();
    await expect(postWalletTransfer(pool, { ...base, actor: { userId: 4, role: "Reseller", status: "Active" } })).rejects.toThrow(/denied/);
    await expect(postWalletTransfer(pool, { ...base, actor: { userId: 1, role: "Admin", status: "Active", permissions: ["wallet:read:any"] } })).rejects.toThrow(/write access denied/);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("denies zero-value and same-wallet transfers before DB access", async () => {
    const pool = { connect: vi.fn() };
    await expect(postWalletTransfer(pool, { ...base, amount: "0" })).rejects.toThrow();
    await expect(postWalletTransfer(pool, { ...base, creditOwnerUserId: 2 })).rejects.toThrow();
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
