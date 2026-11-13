import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
import { generateReply } from "./gateway";

const models = [
  ["google/gemini-4-hydrogen", "low"],
  ["google/gemini-3.8-flash", "low"],
  ["google/gemini-3.5-flash-lite", "minimal"],
] as const;

beforeEach(() => vi.stubEnv("AI_GATEWAY_API_KEY", "test-key"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.each(models)("%s generation", (model, thinkingLevel) => {
  it.each([false, true])(
    "uses a supported thinking level (structured output: %s)",
    async (structured) => {
      const fetch = vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        // Emulate the upstream rejection that broke Hydrogen and Flash.
        if (
          body.providerOptions.google.thinkingConfig.thinkingLevel !==
          thinkingLevel
        ) {
          return Response.json(
            { error: { message: "Thinking level is unsupported" } },
            { status: 400 },
          );
        }
        return Response.json({
          content: [
            { type: "text", text: structured ? '{"answer":"OK"}' : "OK" },
          ],
          finishReason: { unified: "stop", raw: "STOP" },
          usage: {
            inputTokens: {
              total: 20,
              noCache: 20,
              cacheRead: 0,
              cacheWrite: 0,
            },
            outputTokens: { total: 10, text: 6, reasoning: 4 },
          },
          warnings: [],
        });
      });
      vi.stubGlobal("fetch", fetch);
      const result = await generateReply(
        model,
        "Give a concise answer.",
        "Reply with OK.",
        800,
        { id: model, input: 0.000001, output: 0.000005 },
        AbortSignal.timeout(5000),
        0.05,
        structured ? z.object({ answer: z.string() }) : undefined,
      );

      expect(result.text).toBe(structured ? '{"answer":"OK"}' : "OK");
      expect(result.structured).toEqual(
        structured ? { answer: "OK" } : undefined,
      );
      expect(result.reasoningTokens).toBe(4);
      expect(result.output).toBe(10);
      expect(result.cost).toBeCloseTo(0.0000875);
      expect(fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.maxOutputTokens).toBe(
        model === "google/gemini-3.5-flash-lite" ? 800 : 4896,
      );
      expect(body.providerOptions.gateway).toEqual({ sort: "cost" });
    },
  );
});

it.each(["google/gemini-4-hydrogen", "google/gemini-3.8-flash"])(
  "leaves space for a complete answer after %s spends the old allowance thinking",
  async (model) => {
    const fetch = vi.fn(async (_url, init) => {
      const { maxOutputTokens } = JSON.parse(init.body);
      const reasoning = 900;
      const complete = maxOutputTokens >= reasoning + 100;
      return Response.json({
        content: [
          {
            type: "text",
            text: complete ? "Both of you make useful points." : "Both of you",
          },
        ],
        finishReason: { unified: complete ? "stop" : "length" },
        usage: {
          inputTokens: { total: 30 },
          outputTokens: {
            total: complete ? 1000 : maxOutputTokens,
            reasoning: complete ? reasoning : maxOutputTokens - 3,
            text: complete ? 100 : 3,
          },
        },
        warnings: [],
      });
    });
    vi.stubGlobal("fetch", fetch);
    const result = await generateReply(
      model,
      "Contribute briefly to the discussion.",
      "Build on the previous two speakers.",
      800,
      { id: model, input: 0.000001, output: 0.000005 },
      AbortSignal.timeout(5000),
      0.08,
    );
    expect(result.text).toBe("Both of you make useful points.");
    expect(result.finishReason).toBe("stop");
    expect(result.reasoningTokens).toBe(900);
    expect(result.cost).toBeCloseTo((30 * 0.000001 + 1000 * 0.000005) * 1.25);
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
