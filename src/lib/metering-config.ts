/** Empty values use the defaults; invalid values fail closed, never disable a cap. */
export function budgetConfig(env: {
  WEEKLY_BUDGET_USD?: string;
  PREMIUM_WEEKLY_BUDGET_USD?: string;
}) {
  function amount(value: string, name: string) {
    const n = Number(value);
    if (
      !/^\d+(\.\d{1,8})?$/.test(value) ||
      !Number.isFinite(n) ||
      n > Number.MAX_SAFE_INTEGER
    )
      throw new Error(
        `${name} must be a nonnegative USD amount with at most 8 decimal places.`,
      );
    return n;
  }
  const standard = env.WEEKLY_BUDGET_USD?.trim() || "10";
  const premium = env.PREMIUM_WEEKLY_BUDGET_USD?.trim() || "unlimited";
  return {
    p_weekly_budget: amount(standard, "WEEKLY_BUDGET_USD"),
    p_premium_weekly_budget:
      premium.toLowerCase() === "unlimited"
        ? null
        : amount(premium, "PREMIUM_WEEKLY_BUDGET_USD"),
  };
}
