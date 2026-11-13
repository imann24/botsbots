import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ userClient: vi.fn() }));
import { userClient } from "@/lib/supabase/server";
import { GET } from "./route";

const exchange = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  exchange.mockResolvedValue({ error: null });
  vi.mocked(userClient).mockResolvedValue({
    auth: { exchangeCodeForSession: exchange },
  } as unknown as Awaited<ReturnType<typeof userClient>>);
});

describe("Google OAuth callback", () => {
  it("exchanges the code and returns to the same origin without caching", async () => {
    const response = await GET(
      new Request(
        "https://botsbots.app/auth/callback?code=one-time-code&next=https://evil.test",
      ),
    );
    expect(exchange).toHaveBeenCalledExactlyOnceWith("one-time-code");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each([
    ["", "failed"],
    ["?error=access_denied&error_description=private-details", "cancelled"],
    ["?error=server_error&code=untrusted", "failed"],
  ])("handles missing codes and provider errors: %s", async (query, reason) => {
    const response = await GET(
      new Request(`https://botsbots.app/auth/callback${query}`),
    );
    expect(exchange).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`/?auth_error=${reason}`);
  });

  it("returns an actionable error after an expired or reused code", async () => {
    exchange.mockResolvedValue({
      error: new Error("private provider details"),
    });
    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=expired"),
    );
    expect(response.headers.get("location")).toBe("/?auth_error=failed");
  });

  it("recovers when the session service cannot be reached", async () => {
    exchange.mockRejectedValue(new Error("network failure"));
    const response = await GET(
      new Request("https://botsbots.app/auth/callback?code=valid"),
    );
    expect(response.headers.get("location")).toBe("/?auth_error=failed");
  });
});
