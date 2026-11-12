export type AccountUsage = {
  tier: "standard" | "premium";
  limit: number | null;
  spent: number;
  pending: number;
  uncertain: number;
  used: number;
  remaining: number | null;
  periodStart: string;
  resetsAt: string;
};

export function usageLevel(usage: AccountUsage) {
  if (usage.limit === null) return "unlimited";
  if (usage.remaining === 0) return "exhausted";
  return usage.used >= usage.limit * 0.8 ? "warning" : "normal";
}

export const usageMoney = (n: number) =>
  `$${n.toLocaleString("en-US", {
    minimumFractionDigits: n > 0 && n < 0.01 ? 4 : 2,
    maximumFractionDigits: n > 0 && n < 0.01 ? 8 : 2,
  })}`;
