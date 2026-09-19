import { expect, test, vi } from "vitest";
import { revokeL2tpProfile } from "./vpn-peer-service.js";

function harness(protocol = "l2tp_ipsec") {
  const db = {
    query: vi.fn(async sql => {
      if (sql.startsWith("select id,protocol")) return { rows: [{ id: 7, protocol, username: "ngvpn-test", status: "Pending" }] };
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  return { db, pool: { connect: vi.fn(async () => db) } };
}
test("revokes RouterOS 6 RADIUS credentials with status and audit atomically", async () => {
  const { db, pool } = harness();
  await expect(revokeL2tpProfile(pool, { peerId: 7, actorId: 1 })).resolves.toEqual({ id: 7, status: "Revoked" });
  const statements = db.query.mock.calls.map(([sql]) => sql);
  expect(statements).toContain("delete from radcheck where username=$1");
  expect(statements).toContain("delete from radreply where username=$1");
  expect(statements.at(-1)).toBe("COMMIT");
});
test("other protocols do not delete RADIUS credentials", async () => {
  const { db, pool } = harness("wireguard");
  await expect(revokeL2tpProfile(pool, { peerId: 7, actorId: 1 })).rejects.toMatchObject({ status: 409 });
  expect(db.query.mock.calls.some(([sql]) => sql.startsWith("delete from radcheck"))).toBe(false);
  expect(db.query).toHaveBeenLastCalledWith("ROLLBACK");
});
