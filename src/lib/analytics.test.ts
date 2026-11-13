import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "@vercel/analytics";
import {
  lengthBucket,
  redactAnalyticsUrl,
  roomAnalytics,
  trackAction,
  trackEvent,
} from "./analytics";
import { DEFAULT_BOTS, DEFAULT_SETTINGS } from "./types";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.mocked(track).mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("analytics isolation and privacy", () => {
  it("records a single attempt and success only after the operation resolves", async () => {
    let complete!: (value: string) => void;
    const pending = trackAction(
      "room_archive",
      {},
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        }),
    );
    expect(track).toHaveBeenCalledExactlyOnceWith("room_archive_started", {});
    complete("saved");
    await expect(pending).resolves.toBe("saved");
    expect(vi.mocked(track).mock.calls).toEqual([
      ["room_archive_started", {}],
      ["room_archive_succeeded", {}],
    ]);
  });

  it("rethrows the original error without exposing its message or custom name", async () => {
    const error = new Error("Private email: person@example.com");
    error.name = "private-room-title";
    await expect(
      trackAction("sign_in", {}, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(vi.mocked(track).mock.calls).toEqual([
      ["sign_in_started", {}],
      ["sign_in_failed", { error_type: "request" }],
    ]);
  });

  it.each(["TimeoutError", "AbortError"])(
    "classifies %s without its message",
    async (name) => {
      const error = new Error("secret");
      error.name = name;
      await expect(
        trackAction("contact_send", { kind: "support" }, async () => {
          throw error;
        }),
      ).rejects.toBe(error);
      expect(track).toHaveBeenLastCalledWith("contact_send_failed", {
        kind: "support",
        error_type: name === "TimeoutError" ? "timeout" : "aborted",
      });
    },
  );

  it("still executes operations when the telemetry SDK throws", async () => {
    vi.mocked(track).mockImplementation(() => {
      throw new Error("SDK unavailable");
    });
    const operation = vi.fn().mockResolvedValue({ saved: true });
    await expect(trackAction("room_rename", {}, operation)).resolves.toEqual({
      saved: true,
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(() => trackEvent("usage_viewed", {})).not.toThrow();
  });

  it("preserves operation failures even when telemetry also fails", async () => {
    vi.mocked(track).mockImplementation(() => {
      throw new Error("SDK unavailable");
    });
    const error = new Error("write failed");
    await expect(
      trackAction("room_archive", {}, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it("does not report a failed follow-up refresh as a failed mutation", async () => {
    const flow = async () => {
      await trackAction("room_restore", {}, async () => "restored");
      throw new Error("refresh failed");
    };
    await expect(flow()).rejects.toThrow("refresh failed");
    expect(vi.mocked(track).mock.calls.map(([name]) => name)).toEqual([
      "room_restore_started",
      "room_restore_succeeded",
    ]);
  });

  it("does not emit client events while rendering on the server", async () => {
    vi.stubGlobal("window", undefined);
    trackEvent("usage_viewed", {});
    await expect(
      trackAction("defaults_reset", {}, async () => true),
    ).resolves.toBe(true);
    expect(track).not.toHaveBeenCalled();
  });

  it("extracts only aggregate room metadata", () => {
    const room = {
      id: "private-id",
      title: "Private title",
      topic: "Private topic",
      purpose: "plan" as const,
      bots: DEFAULT_BOTS,
      settings: DEFAULT_SETTINGS,
    };
    expect(roomAnalytics(room)).toEqual({
      purpose: "plan",
      mode: "moderated",
      bot_count: 3,
    });
  });

  it("drops nonfinite numbers and oversized property values", () => {
    trackEvent("room_exported", { message_count: NaN, format: "markdown" });
    expect(track).toHaveBeenLastCalledWith("room_exported", {
      format: "markdown",
    });
    trackEvent("bot_model_selected", { model: "x".repeat(256) });
    expect(track).toHaveBeenLastCalledWith("bot_model_selected", {});
  });

  it.each(["pageview", "event"] as const)(
    "redacts room IDs and query/hash contents from %s URLs",
    (type) => {
      const event = {
        type,
        url: "https://botsbots.app/?room=private-id&email=secret#private-text",
      };
      expect(redactAnalyticsUrl(event)).toEqual({
        type,
        url: "https://botsbots.app/",
      });
      expect(event.url).toContain("private-id");
    },
  );

  it("drops malformed URLs instead of risking sensitive data", () => {
    expect(
      redactAnalyticsUrl({ type: "event", url: "private text" }),
    ).toBeNull();
  });

  it("buckets message lengths at the documented boundaries", () => {
    expect([1, 100, 101, 500, 501, 2000, 2001, 4000].map(lengthBucket)).toEqual(
      [
        "1-100",
        "1-100",
        "101-500",
        "101-500",
        "501-2000",
        "501-2000",
        "2001+",
        "2001+",
      ],
    );
  });
});
