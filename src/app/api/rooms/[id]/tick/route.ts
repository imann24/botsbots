import { z } from "zod";
import { authenticated, check, failure, jsonBody, ApiError } from "@/lib/api";
import { modelPrices, reply, reserveCost } from "@/lib/gateway";
import type { Room, Message } from "@/lib/types";
import { weeklyBudgets } from "@/lib/metering";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const { runId } = z.object({ runId: z.uuid() }).parse(await jsonBody(req));
    const { user, db, admin } = await authenticated(req);
    const { data: raw, error } = await db
      .from("rooms")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    check(error);
    if (!raw) throw new ApiError("Room not found.", 404);
    const room = raw as Room;
    if (room.status !== "running" || room.run_id !== runId)
      return Response.json({ claimed: false });
    if (!process.env.AI_GATEWAY_API_KEY)
      throw new ApiError(
        "Set AI_GATEWAY_API_KEY in .env.local before starting.",
        503,
      );
    const prices = await modelPrices();
    const reservations = Object.fromEntries(
      prices.map((p) => [p.id, reserveCost(p, room.settings.maxTokens)]),
    );
    const { data: claimed, error: claimError } = await admin.rpc("claim_turn", {
      p_room: id,
      p_user: user.id,
      p_run: runId,
      p_prices: reservations,
      ...weeklyBudgets(),
    });
    check(claimError);
    if (!claimed) return Response.json({ claimed: false });
    const turn = claimed as Message;
    const bot = room.bots.find((b) => b.id === turn.bot_id)!;
    const price = prices.find((p) => p.id === bot.model)!;
    try {
      const { data: history, error: historyError } = await db
        .from("messages")
        .select("*")
        .eq("room_id", id)
        .eq("status", "complete")
        .lt("sequence", turn.sequence)
        .order("sequence", { ascending: false })
        .limit(room.settings.contextMessages);
      check(historyError);
      const result = await reply(
        room,
        bot,
        (history as Message[]).reverse(),
        price,
        AbortSignal.timeout(75000),
      );
      const { error: finishError } = await admin.rpc("finish_turn", {
        p_room: id,
        p_message: turn.id,
        p_content: result.text,
        p_cost: result.cost,
        p_input: result.input,
        p_output: result.output,
        p_finish_reason: result.finishReason,
        p_reasoning_tokens: result.reasoningTokens,
      });
      check(finishError);
    } catch (e) {
      // Never expose upstream error objects: they may contain request headers or provider details.
      console.error(
        "Generation failed:",
        e instanceof Error ? e.name : "unknown",
      );
      const message =
        e instanceof Error && /no text|key is missing/.test(e.message)
          ? e.message
          : "This model could not finish its reply. Check Gateway credits/model availability, then resume. The reservation is retained because the provider may have billed the request.";
      const { error: finishError } = await admin.rpc("finish_turn", {
        p_room: id,
        p_message: turn.id,
        p_content: "",
        p_cost: null,
        p_input: null,
        p_output: null,
        p_error: message,
      });
      check(finishError);
    }
    return Response.json({ claimed: true });
  } catch (e) {
    return failure(e);
  }
}
