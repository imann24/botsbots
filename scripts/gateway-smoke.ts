// Explicit opt-in: this makes two billable Haiku requests using the configured Gateway key.
// Run: node --conditions=react-server --import tsx scripts/gateway-smoke.ts
import { config } from "dotenv";
import assert from "node:assert/strict";
import { reply, modelPrices } from "../src/lib/gateway";
import { DEFAULT_BOTS, DEFAULT_SETTINGS, type Room } from "../src/lib/types";
config({ path: ".env.local", quiet: true });
const bot = process.argv.includes("--google")
  ? DEFAULT_BOTS[2]
  : DEFAULT_BOTS[1];
const price = (await modelPrices()).find((p) => p.id === bot.model)!;
assert.ok(price);
for (const maxTokens of process.argv.includes("--google")
  ? [800]
  : [450, 800]) {
  const room = {
    topic:
      "Evaluate whether a group chat with multiple AI models helps people make better project plans. Challenge assumptions and suggest a concrete experiment.",
    purpose: "plan",
    settings: { ...DEFAULT_SETTINGS, maxTokens },
  } as Room;
  const result = await reply(room, bot, [], price, AbortSignal.timeout(75000));
  console.log(
    JSON.stringify({
      maxTokens,
      finishReason: result.finishReason,
      outputTokens: result.output,
      reasoningTokens: result.reasoningTokens,
      characters: result.text.length,
      estimatedCost: result.cost,
    }),
  );
  assert.ok(result.text.trim(), "Haiku should return visible text");
  assert.equal(result.finishReason, "stop", "Haiku should finish naturally");
}
