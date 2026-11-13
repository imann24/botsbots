import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountUsageMeter } from "./account-usage";
import type { AccountUsage } from "../lib/usage";

const usage: AccountUsage = {
  tier: "standard",
  limit: 10,
  spent: 3,
  pending: 0.15,
  uncertain: 0.05,
  used: 3.2,
  remaining: 6.8,
  periodStart: "2026-11-09T00:00:00Z",
  resetsAt: "2026-11-16T00:00:00Z",
};
const render = (value: AccountUsage | null, error = false) =>
  renderToStaticMarkup(
    <AccountUsageMeter
      usage={value}
      error={error}
      loading={!value && !error}
      onRefresh={() => {}}
    />,
  );

describe("account usage presentation", () => {
  it("explains the weekly total, allowance and unambiguous UTC reset", () => {
    const html = render(usage);
    for (const text of [
      "Standard",
      "Weekly usage",
      "$3.20",
      "$10.00",
      "$6.80 left",
      "Nov 16",
      "00:00 UTC",
      "Recorded cost",
      "Reserved cost",
      "$0.20",
      "Total used",
    ])
      expect(html).toContain(text);
    expect(html).toContain('aria-label="Weekly account allowance used"');
    expect(html).toContain("not charges to you");
  });
  it.each([
    { pending: 0.15, uncertain: 0, reserved: "$0.15" },
    { pending: 0, uncertain: 0.17, reserved: "$0.17" },
    { pending: 0.15, uncertain: 0.17, reserved: "$0.32" },
  ])(
    "consolidates request reservations: $pending pending, $uncertain unknown",
    (values) => {
      const html = render({
        ...usage,
        spent: 0.07,
        pending: values.pending,
        uncertain: values.uncertain,
        used: 0.07 + values.pending + values.uncertain,
        remaining: 10 - 0.07 - values.pending - values.uncertain,
      });
      expect(html).toContain(
        `<dt>Reserved cost</dt><dd>${values.reserved}</dd>`,
      );
      expect(html).toContain(
        "Reserved cost counts as used until final costs are known.",
      );
      expect(html.includes("Requests that end with unknown costs")).toBe(
        values.uncertain > 0,
      );
      expect(html).not.toContain("Uncertain requests");
      expect(html).not.toContain("In progress");
    },
  );
  it("omits reservation details when all costs are recorded", () => {
    const html = render({
      ...usage,
      pending: 0,
      uncertain: 0,
      used: 3,
      remaining: 7,
    });
    expect(html).toContain("Recorded cost");
    expect(html).toContain("Total used");
    expect(html).not.toContain("Reserved cost");
    expect(html).not.toContain("reservation");
  });
  it("keeps finite premium metered and unlimited premium free of a fake percentage", () => {
    const capped = render({ ...usage, tier: "premium" });
    expect(capped).toContain("Premium");
    expect(capped).toContain("<progress");
    const unlimited = render({
      ...usage,
      tier: "premium",
      limit: null,
      remaining: null,
    });
    expect(unlimited).toContain("$3.20");
    expect(unlimited).toContain("No weekly limit");
    expect(unlimited).not.toContain("<progress");
    expect(unlimited.replace(/<[^>]*>/g, "")).not.toContain("remaining");
  });
  it("uses text for warning and exhaustion, including a zero allowance", () => {
    expect(render({ ...usage, used: 8, remaining: 2 })).toContain(
      "Approaching your weekly limit",
    );
    expect(render({ ...usage, used: 10, remaining: 0 })).toContain(
      "Weekly allowance used",
    );
    expect(render({ ...usage, used: 0, remaining: 0, limit: 0 })).toContain(
      "resume when your allowance changes",
    );
  });
  it("does not invent a zero balance while loading or on failure, and labels stale data", () => {
    expect(render(null)).toContain("Loading usage");
    expect(render(null)).not.toContain("$0");
    expect(render(null, true)).toContain("Retry usage");
    expect(render(null, true)).not.toContain("$0");
    expect(render(usage, true)).toContain("may be out of date");
  });
});
