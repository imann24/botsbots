import { authenticated, check, failure, jsonBody } from "@/lib/api";
import {
  accountDefaultsSchema,
  appDefaults,
  resolveAccountDefaults,
} from "@/lib/account-defaults";
import { assignAgentColors } from "@/lib/agent-colors";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const { db } = await authenticated();
    const { data, error } = await db
      .from("account_preferences")
      .select("default_bots, default_settings, updated_at")
      .maybeSingle();
    check(error);
    return Response.json(
      { defaults: resolveAccountDefaults(data) },
      { headers: noStore },
    );
  } catch (e) {
    return failure(e);
  }
}

export async function PUT(req: Request) {
  try {
    const { user, admin } = await authenticated(req);
    const parsed = accountDefaultsSchema.parse(await jsonBody(req));
    const { data, error } = await admin
      .from("account_preferences")
      .upsert(
        {
          user_id: user.id,
          default_bots: assignAgentColors(parsed.bots),
          default_settings: parsed.settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("default_bots, default_settings, updated_at")
      .single();
    check(error);
    return Response.json(
      { defaults: resolveAccountDefaults(data) },
      { headers: noStore },
    );
  } catch (e) {
    return failure(e);
  }
}

/** Forget saved defaults so new rooms use the app's built-in lineup again. */
export async function DELETE(req: Request) {
  try {
    const { user, admin } = await authenticated(req);
    const { error } = await admin
      .from("account_preferences")
      .delete()
      .eq("user_id", user.id);
    check(error);
    return Response.json({ defaults: appDefaults() }, { headers: noStore });
  } catch (e) {
    return failure(e);
  }
}
