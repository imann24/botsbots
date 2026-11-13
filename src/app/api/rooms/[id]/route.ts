import { z } from "zod";
import { authenticated, check, failure, jsonBody, ApiError } from "@/lib/api";
import { roomSchema, roomTitleSchema } from "@/lib/types";
import { assignAgentColors } from "@/lib/agent-colors";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  try {
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const { db } = await authenticated();
    const [
      { data: room, error },
      { data: messages, error: messageError },
      { data: summaries, error: summaryError },
    ] = await Promise.all([
      db.from("rooms").select("*").eq("id", id).maybeSingle(),
      db.from("messages").select("*").eq("room_id", id).order("sequence"),
      db
        .from("summaries")
        .select("*")
        .eq("room_id", id)
        .order("created_at", { ascending: false }),
    ]);
    check(error);
    check(messageError);
    check(summaryError);
    if (!room) throw new ApiError("Room not found.", 404);
    return Response.json(
      { room, messages, summaries },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: Request, ctx: Context) {
  try {
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const { user, admin } = await authenticated(req);
    const body = z
      .object({
        action: z.enum([
          "start",
          "pause",
          "stop",
          "message",
          "settings",
          "rename",
          "archive",
          "restore",
        ]),
        payload: z.unknown().optional(),
      })
      .parse(await jsonBody(req));
    if (body.action === "rename") {
      const { title } = z
        .object({ title: roomTitleSchema })
        .parse(body.payload);
      // Title-only updates are safe while running or ended. Scope the privileged
      // client to the authenticated owner, and leave orchestration untouched.
      const { data, error } = await admin
        .from("rooms")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .maybeSingle();
      check(error);
      if (!data) throw new ApiError("Room not found.", 404);
      return Response.json({ room: data });
    }
    let payload: unknown = {};
    if (body.action === "message")
      payload = z
        .object({
          content: z.string().trim().min(1).max(4000),
          requestId: z.uuid(),
        })
        .parse(body.payload);
    if (body.action === "settings") {
      const room = roomSchema.parse(body.payload);
      payload = { ...room, bots: assignAgentColors(room.bots) };
    }
    const { data, error } = await admin.rpc("room_action", {
      p_room: id,
      p_user: user.id,
      p_action: body.action,
      p_payload: payload,
    });
    check(error);
    return Response.json({ room: data });
  } catch (e) {
    return failure(e);
  }
}
