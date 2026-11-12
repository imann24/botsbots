import { authenticated, check, failure } from "@/lib/api";
import { weeklyBudgets } from "@/lib/metering";

export async function GET() {
  try {
    const { user, admin } = await authenticated();
    const { data, error } = await admin.rpc("account_usage", {
      p_user: user.id,
      ...weeklyBudgets(),
    });
    check(error);
    return Response.json(
      { usage: data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
