// Every agent in a room gets its own color slot. The slot indexes the
// `.agent-N` hue classes in globals.css, so keep AGENT_COLOR_COUNT in sync.
export const AGENT_COLOR_COUNT = 10;

type Colorable = { id: string; color?: number | undefined };
const isSlot = (n: unknown): n is number =>
  typeof n === "number" &&
  Number.isInteger(n) &&
  n >= 0 &&
  n < AGENT_COLOR_COUNT;

function lowestFree(used: Set<number>): number | null {
  for (let i = 0; i < AGENT_COLOR_COUNT; i++) if (!used.has(i)) return i;
  return null;
}

/**
 * Next unused slot for a bot being added. Falls back to cycling only if a room
 * somehow holds more bots than there are slots.
 */
export function nextAgentColor(bots: Colorable[]): number {
  const used = new Set(bots.map((b) => b.color).filter(isSlot));
  return lowestFree(used) ?? bots.length % AGENT_COLOR_COUNT;
}

/**
 * Returns the bots with a unique `color` each. Valid stored colors win (first
 * bot keeps a contested slot); bots with a missing, invalid or duplicate color
 * take the lowest free slot in list order. Legacy rooms therefore resolve to
 * the same colors a fresh room would have been given.
 */
export function assignAgentColors<T extends Colorable>(
  bots: T[],
): (T & { color: number })[] {
  const used = new Set<number>();
  const kept = bots.map((b) => {
    if (isSlot(b.color) && !used.has(b.color)) {
      used.add(b.color);
      return b.color;
    }
    return null;
  });
  return bots.map((b, i) => {
    const color =
      kept[i] ??
      (() => {
        const free = lowestFree(used);
        if (free === null) return i % AGENT_COLOR_COUNT;
        used.add(free);
        return free;
      })();
    return { ...b, color };
  });
}

/**
 * Bot id → color slot for everything rendered in a conversation. Current bots
 * are resolved first, so they are always unique. Ids that are no longer in the
 * room (removed bots that still have messages) get the remaining free slots in
 * order of first appearance.
 */
export function agentColors(
  bots: Colorable[],
  otherIds: Iterable<string | null | undefined> = [],
): Map<string, number> {
  const map = new Map<string, number>();
  const assigned = assignAgentColors(bots);
  for (const b of assigned) map.set(b.id, b.color);
  const used = new Set(map.values());
  for (const id of otherIds) {
    if (!id || map.has(id)) continue;
    const free = lowestFree(used);
    if (free === null) {
      map.set(id, map.size % AGENT_COLOR_COUNT);
    } else {
      used.add(free);
      map.set(id, free);
    }
  }
  return map;
}

/** Class names for an element tinted with the agent's color. */
export function agentClass(colors: Map<string, number>, id: string | null) {
  const slot = id ? colors.get(id) : undefined;
  return slot === undefined ? "" : `agent agent-${slot}`;
}
