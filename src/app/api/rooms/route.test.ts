import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  authenticated: vi.fn(),
}));
import { ApiError, authenticated } from "@/lib/api";
import { DEFAULT_BOTS, DEFAULT_SETTINGS } from "@/lib/types";
import { POST } from "./route";
import { PATCH } from "./[id]/route";

const id = "a1111111-1111-4111-8111-111111111111";
const userId = "b2222222-2222-4222-8222-222222222222";
const draft = {
  topic: "Plan a tiny weekend adventure",
  purpose: "plan",
  bots: DEFAULT_BOTS,
  settings: DEFAULT_SETTINGS,
};
const insert = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const single = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn();
const rpc = vi.fn();
const query = { insert, update, eq, select, single, maybeSingle };
const request = (method: string, body: unknown) =>
  new Request(`http://localhost/api/rooms/${id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const rename = (title: unknown) =>
  PATCH(request("PATCH", { action: "rename", payload: { title } }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  for (const method of [from, insert, update, eq, select])
    method.mockReturnValue(query);
  single.mockImplementation(async () => ({
    data: { ...insert.mock.calls[0][0], id },
    error: null,
  }));
  maybeSingle.mockResolvedValue({
    data: { ...draft, id, title: "A new title", status: "running" },
    error: null,
  });
  vi.mocked(authenticated).mockResolvedValue({
    user: { id: userId },
    admin: { from, rpc },
  } as unknown as Awaited<ReturnType<typeof authenticated>>);
});
afterEach(() => vi.clearAllMocks());

describe("conversation names", () => {
  it.each([undefined, "", "   "])(
    "persists a goofy default for an unnamed room (%s)",
    async (title) => {
      const req = request("POST", { ...draft, title });
      const response = await POST(req);
      expect(response.status).toBe(201);
      const { room } = await response.json();
      expect(room.title).toMatch(/^[a-z]+-[a-z]+$/);
      expect(room.title.length).toBeLessThanOrEqual(80);
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: room.title,
          user_id: userId,
          topic: draft.topic,
        }),
      );
      expect(authenticated).toHaveBeenCalledWith(req);
    },
  );

  it("preserves an explicit name, trimming surrounding whitespace", async () => {
    const response = await POST(
      request("POST", { ...draft, title: "  My adventure  " }),
    );
    expect((await response.json()).room.title).toBe("My adventure");
  });

  it.each([null, 42, "x".repeat(81)])(
    "rejects invalid creation titles (%s)",
    async (title) => {
      expect((await POST(request("POST", { ...draft, title }))).status).toBe(
        400,
      );
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it("renames only the authenticated owner's title without changing the run", async () => {
    const response = await rename("  A new title  ");
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      title: "A new title",
      updated_at: expect.any(String),
    });
    expect(eq.mock.calls).toEqual([
      ["id", id],
      ["user_id", userId],
    ]);
    expect((await response.json()).room.status).toBe("running");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["", "   ", undefined, null, "x".repeat(81)])(
    "rejects invalid renames (%s)",
    async (title) => {
      expect((await rename(title)).status).toBe(400);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("accepts an 80-character title", async () => {
    expect((await rename("x".repeat(80))).status).toBe(200);
    expect(update.mock.calls[0][0].title).toHaveLength(80);
  });

  it("returns 404 for a missing room or one belonging to another user", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await rename("New title")).status).toBe(404);
    expect(eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("requires authentication for creation and renaming", async () => {
    vi.mocked(authenticated).mockRejectedValue(
      new ApiError("Sign in to continue.", 401),
    );
    expect((await POST(request("POST", draft))).status).toBe(401);
    expect((await rename("New title")).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a blank settings title without regenerating it", async () => {
    const response = await PATCH(
      request("PATCH", {
        action: "settings",
        payload: { ...draft, title: " " },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
