import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  authenticated: vi.fn(),
}));
import { ApiError, authenticated } from "@/lib/api";
import { POST } from "./route";

const fetchMock = vi.fn();
const payload = {
  kind: "support",
  email: "reply@example.test",
  message: "Please help me with my conversation.",
};
const request = (body: unknown = payload) =>
  new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RESEND_API_KEY", "test-resend-key");
  vi.stubEnv("CONTACT_ADMIN_EMAIL", "");
  vi.stubEnv("CONTACT_FROM_EMAIL", "");
  vi.mocked(authenticated).mockResolvedValue({
    user: { id: "account-123", email: "account@example.test" },
  } as Awaited<ReturnType<typeof authenticated>>);
  fetchMock.mockResolvedValue(Response.json({ id: "email-123" }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("contact delivery", () => {
  it.each(["support", "question", "feedback", "limits"])(
    "delivers %s with default addresses and trusted account identity",
    async (kind) => {
      const req = request({ ...payload, kind });
      const response = await POST(req);
      expect(response.status).toBe(200);
      expect(authenticated).toHaveBeenCalledWith(req);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.resend.com/emails");
      const body = JSON.parse(options.body);
      expect(body).toMatchObject({
        from: "noreply@botsbots.app",
        to: ["hello@botsbots.app"],
        reply_to: payload.email,
      });
      expect(body.text).toContain("Account email: account@example.test");
      expect(body.text).toContain("Account ID: account-123");
      expect(body.text).toContain(payload.message);
      expect(options.headers.Authorization).toBe("Bearer test-resend-key");
      expect(body.subject).toContain(
        kind === "limits"
          ? "Higher usage limits"
          : kind[0].toUpperCase() + kind.slice(1),
      );
    },
  );

  it("honors server environment address overrides", async () => {
    vi.stubEnv("CONTACT_ADMIN_EMAIL", "owner@example.test");
    vi.stubEnv("CONTACT_FROM_EMAIL", "BotsBots <contact@example.test>");
    await POST(request());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      from: "BotsBots <contact@example.test>",
      to: ["owner@example.test"],
    });
  });

  it("deduplicates identical retries and separates different accounts or content", async () => {
    await POST(request());
    await POST(request());
    await POST(
      request({ ...payload, message: "A different request for support." }),
    );
    vi.mocked(authenticated).mockResolvedValue({
      user: { id: "other-account", email: "account@example.test" },
    } as Awaited<ReturnType<typeof authenticated>>);
    await POST(request());
    const keys = fetchMock.mock.calls.map(
      (call) => call[1].headers["Idempotency-Key"],
    );
    expect(keys[0]).toBe(keys[1]);
    expect(new Set(keys).size).toBe(3);
  });

  it.each([
    { ...payload, kind: "other" },
    { ...payload, email: "bad\r\nBcc: victim@example.test" },
    { ...payload, message: "          " },
    { ...payload, message: "x".repeat(5001) },
  ])("rejects invalid input before contacting Resend", async (input) => {
    expect((await POST(request(input))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers before sending", async () => {
    vi.mocked(authenticated).mockRejectedValue(
      new ApiError("Sign in to continue.", 401),
    );
    expect((await POST(request())).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports missing configuration without pretending to send", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await POST(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps Resend errors private and allows retry after a failed send", async () => {
    fetchMock.mockResolvedValue(
      new Response("private provider error", { status: 403 }),
    );
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private provider error");
    fetchMock.mockResolvedValue(Response.json({ id: "email-123" }));
    expect((await POST(request())).status).toBe(200);
  });

  it("returns a recoverable error when Resend times out", async () => {
    fetchMock.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("try again");
  });
});
