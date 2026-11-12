import { describe, expect, it } from "vitest";
import {
  AGENT_COLOR_COUNT,
  agentClass,
  agentColors,
  assignAgentColors,
  nextAgentColor,
} from "./agent-colors";
import { DEFAULT_BOTS, botSchema } from "./types";

const bot = (id: string, color?: number) => ({ id, color });
const ids = (n: number) => Array.from({ length: n }, (_, i) => `bot-${i}`);

describe("agent colors", () => {
  it("gives every bot a unique color, including same-model bots", () => {
    const out = assignAgentColors(ids(6).map((id) => bot(id)));
    expect(new Set(out.map((b) => b.color)).size).toBe(6);
  });

  it("keeps stored colors stable when other bots are removed", () => {
    const before = assignAgentColors(ids(4).map((id) => bot(id)));
    const after = assignAgentColors(before.filter((b) => b.id !== "bot-1"));
    for (const b of after)
      expect(b.color).toBe(before.find((x) => x.id === b.id)!.color);
  });

  it("repairs duplicate or invalid stored colors", () => {
    const out = assignAgentColors([
      bot("a", 2),
      bot("b", 2),
      bot("c", 99),
      bot("d", -1),
      bot("e"),
    ]);
    expect(out[0].color).toBe(2);
    expect(new Set(out.map((b) => b.color)).size).toBe(5);
    for (const b of out) {
      expect(b.color).toBeGreaterThanOrEqual(0);
      expect(b.color).toBeLessThan(AGENT_COLOR_COUNT);
    }
  });

  it("picks an unused slot for a newly added bot", () => {
    const bots = assignAgentColors(ids(3).map((id) => bot(id)));
    const next = nextAgentColor(bots);
    expect(bots.map((b) => b.color)).not.toContain(next);
    expect(nextAgentColor([bot("x", 0), bot("y", 2)])).toBe(1);
  });

  it("colors removed bots uniquely, apart from current bots", () => {
    const colors = agentColors(
      ids(3).map((id) => bot(id)),
      ["bot-0", "gone-1", null, "gone-2", "gone-1"],
    );
    expect(colors.size).toBe(5);
    expect(new Set(colors.values()).size).toBe(5);
  });

  it("never gives two current bots the same color, even beyond the palette", () => {
    const colors = agentColors(ids(AGENT_COLOR_COUNT).map((id) => bot(id)));
    expect(new Set(colors.values()).size).toBe(AGENT_COLOR_COUNT);
  });

  it("returns no class for humans and unknown ids", () => {
    const colors = agentColors([bot("a")]);
    expect(agentClass(colors, null)).toBe("");
    expect(agentClass(colors, "nope")).toBe("");
    expect(agentClass(colors, "a")).toBe("agent agent-0");
  });

  it("ships default bots with distinct colors that pass the bot schema", () => {
    expect(new Set(DEFAULT_BOTS.map((b) => b.color)).size).toBe(
      DEFAULT_BOTS.length,
    );
    for (const b of DEFAULT_BOTS)
      expect(botSchema.safeParse(b).success).toBe(true);
    expect(botSchema.safeParse({ ...DEFAULT_BOTS[0], color: 99 }).success).toBe(
      false,
    );
  });
});
