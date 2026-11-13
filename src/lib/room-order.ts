import type { Room } from "./types";

// Match the server's activity order, including stable ties. Archive actions
// leave these timestamps alone, so restoring a chat returns it to its place.
export function compareRooms(a: Room, b: Room) {
  return (
    Date.parse(b.updated_at) - Date.parse(a.updated_at) ||
    Date.parse(b.created_at) - Date.parse(a.created_at) ||
    a.id.localeCompare(b.id)
  );
}
