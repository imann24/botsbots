import { authenticated, check, failure, jsonBody } from "@/lib/api";
import { roomSchema } from "@/lib/types";
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
    const draft = roomSchema.parse(await jsonBody(req));
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
