import { describe, expect, it } from "vitest";
import { budgetConfig } from "./metering-config";
import { usageLevel, usageMoney, type AccountUsage } from "./usage";

describe("weekly budget configuration", () => {
  it("defaults standard to $10 and premium to unlimited, including blank env values", () => {
    for (const env of [
      {},
      { WEEKLY_BUDGET_USD: "  ", PREMIUM_WEEKLY_BUDGET_USD: "" },
    ])
      expect(budgetConfig(env)).toEqual({
        p_weekly_budget: 10,
        p_premium_weekly_budget: null,
      });
  });
  it("supports finite premium caps and zero allowances", () => {
    expect(
      budgetConfig({
        WEEKLY_BUDGET_USD: "0",
        PREMIUM_WEEKLY_BUDGET_USD: "25.50",
      }),
    ).toEqual({ p_weekly_budget: 0, p_premium_weekly_budget: 25.5 });
    expect(
      budgetConfig({ PREMIUM_WEEKLY_BUDGET_USD: "0" }).p_premium_weekly_budget,
    ).toBe(0);
    expect(
      budgetConfig({ PREMIUM_WEEKLY_BUDGET_USD: " UNLIMITED " })
        .p_premium_weekly_budget,
    ).toBeNull();
  });
  it("fails closed on malformed, negative or nonfinite values", () => {
    for (const value of [
      "-1",
      "NaN",
      "Infinity",
      "1e3",
      "ten",
      "$10",
      "0x10",
      "0.000000001",
      "9999999999999999999999",
    ])
      for (const key of ["WEEKLY_BUDGET_USD", "PREMIUM_WEEKLY_BUDGET_USD"])
        expect(() => budgetConfig({ [key]: value })).toThrow();
    expect(() => budgetConfig({ WEEKLY_BUDGET_USD: "unlimited" })).toThrow();
  });
});

describe("usage states", () => {
  const base: AccountUsage = {
    tier: "standard",
    limit: 10,
    spent: 7,
    pending: 0.5,
    uncertain: 0.5,
    used: 8,
    remaining: 2,
    periodStart: "2026-11-09T00:00:00Z",
    resetsAt: "2026-11-16T00:00:00Z",
  };
  it("includes reservations in warnings and handles unlimited, zero and overspend", () => {
    expect(usageLevel(base)).toBe("warning");
    expect(usageLevel({ ...base, used: 7.99 })).toBe("normal");
    expect(
      usageLevel({ ...base, tier: "premium", limit: null, remaining: null }),
    ).toBe("unlimited");
    expect(usageLevel({ ...base, used: 11, remaining: 0 })).toBe("exhausted");
    expect(usageLevel({ ...base, limit: 0, used: 0, remaining: 0 })).toBe(
      "exhausted",
    );
  });
  it("keeps sub-cent costs visible", () => {
    expect(usageMoney(0.0034)).toBe("$0.0034");
    expect(usageMoney(10)).toBe("$10.00");
  });
});
