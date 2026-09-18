import { describe, expect, it } from "vitest";
import { addCalendarMonthUtc, calculateRechargeAmountMinor, prorateMinorHalfUp } from "./recharge-calculation.js";
describe("recharge calculation", () => {
  it("charges the complete package price for a full cycle", () => {
    expect(calculateRechargeAmountMinor({ mode: "full_cycle", packagePriceMinor: 50000n })).toBe(50000n);
  });
  it("prorates with integer half-up rounding", () => {
    expect(prorateMinorHalfUp(50000n, 1, 30)).toBe(1667n);
    expect(prorateMinorHalfUp(100n, 1, 6)).toBe(17n);
  });
  it("handles month ends and leap years", () => {
    expect(addCalendarMonthUtc("2025-01-31")).toBe("2025-02-28");
    expect(addCalendarMonthUtc("2024-01-31")).toBe("2024-02-29");
    expect(addCalendarMonthUtc("2024-02-29")).toBe("2024-03-29");
  });
});
