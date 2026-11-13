import { describe, it, expect } from "vitest";
import {
  buildPrompt,
  reserveCost,
  usageCost,
  INPUT_RESERVATION_TOKENS,
  replyWordTarget,
  outputTokenLimit,
} from "./prompt";
import {
  DEFAULT_BOTS,
  DEFAULT_SETTINGS,
  roomSchema,
  type Room,
  type Message,
} from "./types";
const room = {
  topic: "Help plan a project",
  purpose: "plan",
  bots: DEFAULT_BOTS,
  settings: DEFAULT_SETTINGS,
} as Room;
describe("spend controls", () => {
  it.each(["google/gemini-4-hydrogen", "google/gemini-3.8-flash"] as const)(
    "reserves the complete output allowance including required thinking for %s",
    (model) => {
      const price = { id: model, input: 0.000001, output: 0.000005 };
      for (const maxTokens of [128, 800, 2000]) {
        const cap = outputTokenLimit(model, maxTokens);
        expect(cap).toBe(maxTokens + 4096);
        expect(reserveCost(price, maxTokens)).toBeGreaterThanOrEqual(
          usageCost(price, INPUT_RESERVATION_TOKENS, cap),
        );
        const prompt = buildPrompt(
          { ...room, settings: { ...DEFAULT_SETTINGS, maxTokens } },
          {
            ...DEFAULT_BOTS[2],
            model,
          },
          [],
        );
        expect(prompt.system).toContain(
          `under ${replyWordTarget(maxTokens)} words`,
        );
      }
    },
  );
  it.each([
    "google/gemini-3.5-flash-lite",
    "openai/gpt-6-luna",
    "anthropic/claude-haiku-5.5",
  ])("preserves the configured output cap for %s", (model) =>
    expect(outputTokenLimit(model, 800)).toBe(800),
  );
  it("keeps the requested answer short enough to leave output headroom", () => {
    expect(replyWordTarget(450)).toBeLessThanOrEqual(100);
    expect(replyWordTarget(2000)).toBeLessThanOrEqual(160);
    expect(replyWordTarget(128)).toBeGreaterThan(0);
    expect(buildPrompt(room, DEFAULT_BOTS[0], []).system).toContain(
      "finish all sentences",
    );
  });
  it("reserves more than the full allowed input and output at current prices", () => {
    const price = { id: "test", input: 0.000001, output: 0.000005 };
    expect(reserveCost(price, 450)).toBeGreaterThan(
      INPUT_RESERVATION_TOKENS * price.input + 450 * price.output,
    );
    expect(usageCost(price, 500, 300)).toBeLessThan(reserveCost(price, 450));
  });
  it("bounds even multilingual transcript bytes and preserves recent messages", () => {
    const messages = Array.from(
      { length: 30 },
      (_, i) =>
        ({
          speaker: "User",
          content: `${i}:` + "🌳".repeat(1000),
          status: "complete",
        }) as Message,
    );
    const p = buildPrompt(room, DEFAULT_BOTS[0], messages);
    expect(Buffer.byteLength(p.prompt + p.system)).toBeLessThan(
      INPUT_RESERVATION_TOKENS,
    );
    expect(p.prompt).toContain("29:");
    expect(p.prompt).not.toContain("0:");
  });
  it("rejects premium/unlisted models and unsafe settings", () => {
    const draft = {
      title: "Test",
      topic: "Discuss this",
      purpose: "plan",
      bots: DEFAULT_BOTS,
      settings: DEFAULT_SETTINGS,
    };
    expect(roomSchema.safeParse(draft).success).toBe(true);
    expect(
      roomSchema.safeParse({
        ...draft,
        bots: [{ ...DEFAULT_BOTS[0], model: "xai/grok" }, DEFAULT_BOTS[1]],
      }).success,
    ).toBe(false);
    expect(
      roomSchema.safeParse({
        ...draft,
        settings: { ...DEFAULT_SETTINGS, concurrency: 100 },
      }).success,
    ).toBe(false);
  });
});
