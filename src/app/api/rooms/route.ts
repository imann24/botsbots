import { authenticated, check, failure, jsonBody } from "@/lib/api";
import { createRoomSchema } from "@/lib/types";
import { assignAgentColors } from "@/lib/agent-colors";
import { generateRoomTitle } from "@/lib/room-title";
export async function GET() {
  try {
    const { db } = await authenticated();
    const { data, error } = await db
      .from("rooms")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);
    check(error);
    return Response.json({ rooms: data });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const { user, admin } = await authenticated(req);
    const parsed = createRoomSchema.parse(await jsonBody(req));
    const draft = {
      ...parsed,
      title: parsed.title || generateRoomTitle(),
      bots: assignAgentColors(parsed.bots),
    };
    const { data, error } = await admin
      .from("rooms")
      .insert({ ...draft, user_id: user.id })
      .select()
      .single();
    check(error);
    return Response.json({ room: data }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
