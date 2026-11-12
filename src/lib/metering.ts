import "server-only";
import { ApiError } from "./api";
import { budgetConfig } from "./metering-config";

export function weeklyBudgets() {
  try {
    return budgetConfig({
      WEEKLY_BUDGET_USD: process.env.WEEKLY_BUDGET_USD,
      PREMIUM_WEEKLY_BUDGET_USD: process.env.PREMIUM_WEEKLY_BUDGET_USD,
    });
  } catch (error) {
    throw new ApiError((error as Error).message, 503);
  }
}
