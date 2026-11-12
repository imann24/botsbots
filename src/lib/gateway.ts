import "server-only";
import { createGateway, generateText, Output } from "ai";
import type { z } from "zod";
import { MODEL_CHOICES, type ModelPrice } from "./models";
import type { Bot, Room, Message } from "./types";
import { buildPrompt, reserveCost, usageCost } from "./prompt";
export { reserveCost } from "./prompt";
let cache: { expires: number; prices: ModelPrice[] } | undefined;
export async function modelPrices(): Promise<ModelPrice[]> {
  if (cache && cache.expires > Date.now()) return cache.prices;
  const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error("Model pricing is unavailable. Try again shortly.");
  const body = (await response.json()) as {
    data: {
      id: string;
      pricing?: {
        input: string;
        output: string;
        input_tiers?: { cost: string }[];
        output_tiers?: { cost: string }[];
      };
    }[];
  };
  const prices = MODEL_CHOICES.flatMap((choice) => {
    const model = body.data.find((m) => m.id === choice.id);
    if (!model?.pricing) return [];
    // Reserve using the highest listed tier; context is additionally bounded by bytes.
    const input = Math.max(
      Number(model.pricing.input),
      ...(model.pricing.input_tiers ?? []).map((t) => Number(t.cost)),
    );
    const output = Math.max(
      Number(model.pricing.output),
      ...(model.pricing.output_tiers ?? []).map((t) => Number(t.cost)),
    );
    return Number.isFinite(input) &&
      Number.isFinite(output) &&
      input >= 0 &&
      output > 0
      ? [{ id: choice.id, input, output }]
      : [];
  });
  cache = { prices, expires: Date.now() + 300000 };
  return prices;
}
export async function reply(
  room: Room,
  bot: Bot,
  history: Message[],
  price: ModelPrice,
  signal: AbortSignal,
) {
  const { system, prompt } = buildPrompt(room, bot, history);
  return generateReply(
    bot.model,
    system,
    prompt,
    room.settings.maxTokens,
    price,
    signal,
    reserveCost(price, room.settings.maxTokens),
  );
}
export async function generateReply(
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  price: ModelPrice,
  signal: AbortSignal,
  reservation: number,
  schema?: z.ZodType,
) {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key)
    throw new Error(
      "Gateway key is missing. Set AI_GATEWAY_API_KEY in .env.local.",
    );
  const gateway = createGateway({ apiKey: key });
  const result = await generateText({
    model: gateway(model),
    system,
    prompt,
    ...(schema ? { output: Output.object({ schema }) } : {}),
    maxOutputTokens: maxTokens,
    maxRetries: 0,
    abortSignal: signal,
    // Spend the small reply allowance on visible text where the model supports it.
    reasoning: "none",
    providerOptions: {
      gateway: { sort: "cost" },
      // Gemini 3 requires thinking; explicitly select its lowest native level.
      ...(model.startsWith("google/")
        ? { google: { thinkingConfig: { thinkingLevel: "minimal" } } }
        : {}),
    },
  });
  if (!result.text.trim() && result.finishReason !== "length")
    throw new Error(
      "The model returned no text. Try a different model or a larger reply token limit.",
    );
  const input = result.totalUsage.inputTokens ?? 0,
    output = result.totalUsage.outputTokens ?? 0;
  // Charge conservatively when usage is absent. Never assume missing usage is free.
  let cost =
    result.totalUsage.inputTokens === undefined ||
    result.totalUsage.outputTokens === undefined
      ? reservation
      : usageCost(price, input, output);
  const metadata = result.providerMetadata?.gateway;
  const reported = metadata?.cost;
  if (
    typeof reported === "number" &&
    Number.isFinite(reported) &&
    reported >= 0
  )
    cost = Math.max(cost, reported);
  return {
    text: result.text,
    structured: schema ? result.output : undefined,
    input,
    output,
    cost,
    finishReason: result.finishReason,
    reasoningTokens:
      result.totalUsage.outputTokenDetails?.reasoningTokens ?? null,
  };
}
