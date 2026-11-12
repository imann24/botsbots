import { describe, it, expect } from "vitest";
import {
  buildSummaryPrompt,
  summaryReservation,
  SUMMARY_MAX_TOKENS,
} from "./summary";
import type { Message } from "./types";
describe("manual summary snapshot", () => {
  const messages = Array.from(
    { length: 20 },
    (_, i) =>
      ({
        id: `message-${i}`,
        sequence: i,
        speaker: i === 0 ? "Early contributor" : "Planner",
        model: i === 0 ? "anthropic/claude-haiku-5.5" : "openai/gpt-6-luna",
        bot_id: `bot-${i % 2}`,
        status: "complete",
        content: `Point ${i}`,
        finish_reason: "stop",
      }) as Message,
  );
  it("includes early and recent contributions with model attribution, not just recent context", () => {
    const result = buildSummaryPrompt({ topic: "Plan a project" }, messages);
    expect(result.source).toHaveLength(20);
    expect(result.prompt).toContain("Early contributor");
    expect(result.prompt).toContain("Point 19");
    expect(result.prompt).toContain("anthropic/claude-haiku-5.5");
    expect(result.participants).toHaveLength(3); // A bot that changes models remains separately attributed.
    expect(
      result.schema.safeParse({
        contributions: { p0: "Only one participant" },
        synthesis: "Missing others",
      }).success,
    ).toBe(false);
  });
  it("excludes unfinished/failed calls and marks incomplete text", () => {
    const result = buildSummaryPrompt({ topic: "Plan" }, [
      { ...messages[0], finish_reason: "length" },
      { ...messages[1], status: "pending" },
      { ...messages[2], status: "failed" },
      { ...messages[3], bot_id: null, model: null, speaker: "You" },
    ]);
    expect(result.source).toHaveLength(2);
    expect(result.prompt).toContain('"incomplete":true');
    expect(result.prompt).toContain('"speaker":"You"');
  });
  it("fails clearly instead of silently omitting oversized history", () => {
    expect(() =>
      buildSummaryPrompt({ topic: "Plan" }, [
        { ...messages[0], content: "🌳".repeat(15000) },
      ]),
    ).toThrow("too long");
    expect(() => buildSummaryPrompt({ topic: "Plan" }, [])).toThrow(
      "at least one bot reply",
    );
  });
  it("reserves the full serialized input and output with margin", () => {
    const result = buildSummaryPrompt({ topic: "Plan" }, messages);
    const price = { id: "test", input: 0.000001, output: 0.000005 };
    expect(result.inputReservationTokens).toBeGreaterThan(
      Buffer.byteLength(result.system + result.prompt),
    );
    expect(
      summaryReservation(price, result.inputReservationTokens),
    ).toBeGreaterThan(
      result.inputReservationTokens * price.input +
        SUMMARY_MAX_TOKENS * price.output,
    );
  });
});
