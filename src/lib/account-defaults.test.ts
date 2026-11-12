import { describe, expect, it } from "vitest";
import {
  accountDefaultsSchema,
  appDefaults,
  resolveAccountDefaults,
  sameLineup,
} from "./account-defaults";
import { DEFAULT_BOTS, DEFAULT_SETTINGS } from "./types";

const custom = {
  bots: [
    { ...DEFAULT_BOTS[1], name: "The skeptic" },
    { ...DEFAULT_BOTS[0], perspective: "Ship the smallest useful thing." },
  ],
  settings: { ...DEFAULT_SETTINGS, mode: "free" as const, maxTokens: 1200 },
};

describe("account defaults", () => {
  it("uses app defaults when nothing is saved", () => {
    const d = resolveAccountDefaults(null);
    expect(d.custom).toBe(false);
    expect(
      sameLineup(d, { bots: DEFAULT_BOTS, settings: DEFAULT_SETTINGS }),
    ).toBe(true);
  });

  it("returns a saved lineup and limits", () => {
    const d = resolveAccountDefaults({
      default_bots: custom.bots,
      default_settings: custom.settings,
      updated_at: "2026-11-12T00:00:00Z",
    });
    expect(d.custom).toBe(true);
    expect(d.bots.map((b) => b.name)).toEqual([
      "The skeptic",
      "The strategist",
    ]);
    expect(d.settings.mode).toBe("free");
    expect(d.updatedAt).toBe("2026-11-12T00:00:00Z");
    expect(sameLineup(d, custom)).toBe(true);
  });

  it("falls back per part when a stored value no longer validates", () => {
    const retired = [
      { ...custom.bots[0], model: "retired/model" },
      custom.bots[1],
    ];
    const d = resolveAccountDefaults({
      default_bots: retired,
      default_settings: custom.settings,
    });
    expect(d.custom).toBe(true);
    expect(d.bots).toEqual(appDefaults().bots);
    expect(d.settings.maxTokens).toBe(1200);
    expect(
      resolveAccountDefaults({
        default_bots: retired,
        default_settings: { mode: "x" },
      }).custom,
    ).toBe(false);
  });

  it("gives saved bots unique colors", () => {
    const d = resolveAccountDefaults({
      default_bots: custom.bots.map((b) => ({ ...b, color: 3 })),
      default_settings: custom.settings,
    });
    expect(new Set(d.bots.map((b) => b.color)).size).toBe(2);
  });

  it("rejects lineups a room could not use", () => {
    expect(
      accountDefaultsSchema.safeParse({ ...custom, bots: [custom.bots[0]] })
        .success,
    ).toBe(false);
    expect(
      accountDefaultsSchema.safeParse({
        ...custom,
        bots: [custom.bots[0], custom.bots[0]],
      }).success,
    ).toBe(false);
    expect(accountDefaultsSchema.safeParse(custom).success).toBe(true);
  });

  it("compares lineups regardless of key order", () => {
    const reordered = {
      bots: custom.bots.map(({ perspective, model, name, id, color }) => ({
        perspective,
        color,
        model,
        name,
        id,
      })),
      settings: Object.fromEntries(
        Object.entries(custom.settings).reverse(),
      ) as typeof custom.settings,
    };
    expect(sameLineup(custom, reordered)).toBe(true);
    expect(
      sameLineup(custom, {
        ...custom,
        settings: { ...custom.settings, budget: 1 },
      }),
    ).toBe(false);
  });
});
