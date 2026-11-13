import { expect, it } from "vitest";
import { compareRooms } from "./room-order";
import type { Room } from "./types";

it("returns restored chats to their original positions, including tied activity times", () => {
  const rooms = [
    {
      id: "a",
      updated_at: "2026-11-12T12:00:00Z",
      created_at: "2026-11-11T12:00:00Z",
    },
    {
      id: "b",
      updated_at: "2026-11-12T12:00:00Z",
      created_at: "2026-11-11T12:00:00Z",
    },
    {
      id: "c",
      updated_at: "2026-11-10T12:00:00Z",
      created_at: "2026-11-10T12:00:00Z",
    },
  ] as Room[];
  for (const restored of rooms) {
    const remaining = rooms.filter((r) => r.id !== restored.id);
    expect(
      [restored, ...remaining].sort(compareRooms).map((r) => r.id),
    ).toEqual(["a", "b", "c"]);
  }
});
