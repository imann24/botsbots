import { z } from "zod";
import { authenticated, ApiError, check, failure, jsonBody } from "@/lib/api";
import { generateReply, modelPrices } from "@/lib/gateway";
import { MODEL_CHOICES } from "@/lib/models";
import {
  buildSummaryPrompt,
  SUMMARY_MAX_TOKENS,
  summaryReservation,
  type Summary,
} from "@/lib/summary";
import type { Message, Room } from "@/lib/types";
export const runtime = "nodejs";
export const maxDuration = 90;

// Only a user-initiated POST reaches the paid call. GET/polling never generates.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    z.uuid().parse(id);
    const { user, db, admin } = await authenticated(req);
    const body = z
      .object({
        model: z.enum(MODEL_CHOICES.map((m) => m.id)),
        requestId: z.uuid(),
      })
      .parse(await jsonBody(req));
    const [{ data: room, error }, { data: messages, error: messageError }] =
      await Promise.all([
        db.from("rooms").select("*").eq("id", id).maybeSingle(),
        db.from("messages").select("*").eq("room_id", id).order("sequence"),
      ]);
    check(error);
    check(messageError);
    if (!room) throw new ApiError("Room not found.", 404);
    if (!process.env.VERCEL_AI_GATEWAY_API_KEY)
      throw new ApiError("Gateway key is missing.", 503);
    let prompt;
    try {
      prompt = buildSummaryPrompt(room as Room, messages as Message[]);
    } catch (e) {
      throw new ApiError((e as Error).message);
    }
    const price = (await modelPrices()).find((p) => p.id === body.model);
    if (!price)
      throw new ApiError(
        "Current pricing for this model is unavailable. Choose another model.",
        503,
      );
    const daily = Number(process.env.DAILY_BUDGET_USD ?? 10);
    if (!Number.isFinite(daily) || daily <= 0)
      throw new ApiError("DAILY_BUDGET_USD must be positive.", 503);
    const reservation = summaryReservation(
      price,
      prompt.inputReservationTokens,
    );
    const { data: claim, error: claimError } = await admin.rpc(
      "claim_summary",
      {
        p_room: id,
        p_user: user.id,
        p_request: body.requestId,
        p_model: body.model,
        p_source_ids: prompt.source.map((m) => m.id),
        p_quote: reservation,
        p_daily_budget: daily,
      },
    );
    check(claimError);
    if (!claim.claimed) return Response.json({ summary: claim.summary });
    const summary = claim.summary as Summary;
    try {
      const result = await generateReply(
        body.model,
        prompt.system,
        prompt.prompt,
        SUMMARY_MAX_TOKENS,
        price,
        AbortSignal.timeout(75000),
        reservation,
        prompt.schema,
      );
      const structured = prompt.schema.parse(result.structured);
      const content = JSON.stringify({
        version: 1,
        contributions: prompt.participants.map((p) => ({
          botId: p.botId,
          speaker: p.speaker,
          model: p.model,
          text: structured.contributions[p.key],
        })),
        synthesis: structured.synthesis,
      });
      const { error: finishError } = await admin.rpc("finish_summary", {
        p_summary: summary.id,
        p_content: content,
        p_cost: result.cost,
        p_finish_reason: result.finishReason,
      });
      check(finishError);
    } catch (e) {
      console.error("Summary failed:", e instanceof Error ? e.name : "unknown");
      const { error: finishError } = await admin.rpc("finish_summary", {
        p_summary: summary.id,
        p_content: "",
        p_cost: null,
        p_error:
          "The summary could not finish. You can try again manually. Its budget reservation is retained because the provider may have billed the request.",
      });
      check(finishError);
    }
    const { data: finished, error: readError } = await db
      .from("summaries")
      .select("*")
      .eq("id", summary.id)
      .single();
    check(readError);
    return Response.json({ summary: finished });
  } catch (e) {
    return failure(e);
  }
}
