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
  it("shows the server allowance, reservations and unambiguous UTC reset", () => {
    const html = render(usage);
    for (const text of [
      "Standard",
      "$3.20",
      "$10.00",
      "$6.80 left",
      "Nov 16",
      "00:00 UTC",
      "Recorded spend",
      "$0.15",
      "$0.05",
    ])
      expect(html).toContain(text);
    expect(html).toContain('aria-label="Weekly account allowance used"');
    expect(html).toContain("not charges to you");
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
