import { z } from "zod";
import { assignAgentColors } from "./agent-colors";
import {
  DEFAULT_BOTS,
  DEFAULT_SETTINGS,
  roomSchema,
  settingsSchema,
  type Bot,
  type Settings,
} from "./types";

/** What an account can save as the starting point for new rooms. */
export const accountDefaultsSchema = z.object({
  bots: roomSchema.shape.bots,
  settings: settingsSchema,
});
export type AccountDefaults = {
  bots: Bot[];
  settings: Settings;
  /** False when the account has nothing saved and app defaults apply. */
  custom: boolean;
  updatedAt: string | null;
};

export function appDefaults(): AccountDefaults {
  return {
    bots: structuredClone(DEFAULT_BOTS),
    settings: { ...DEFAULT_SETTINGS },
    custom: false,
    updatedAt: null,
  };
}

/**
 * Turns a stored preferences row into usable defaults. Rows saved against an
 * older model catalog or older limits can stop validating; each part then
 * falls back to the app default on its own instead of breaking new rooms.
 */
export function resolveAccountDefaults(
  row: {
    default_bots: unknown;
    default_settings: unknown;
    updated_at?: string | null;
  } | null,
): AccountDefaults {
  if (!row) return appDefaults();
  const bots = roomSchema.shape.bots.safeParse(row.default_bots);
  const settings = settingsSchema.safeParse(row.default_settings);
  if (!bots.success && !settings.success) return appDefaults();
  return {
    bots: bots.success
      ? assignAgentColors(bots.data)
      : structuredClone(DEFAULT_BOTS),
    settings: settings.success ? settings.data : { ...DEFAULT_SETTINGS },
    custom: true,
    updatedAt: row.updated_at ?? null,
  };
}

const lineupKey = ({
  bots,
  settings,
}: Pick<AccountDefaults, "bots" | "settings">) =>
  JSON.stringify([
    bots.map((b) => [b.id, b.name, b.model, b.perspective, b.color ?? null]),
    Object.keys(settings)
      .sort()
      .map((k) => [k, settings[k as keyof Settings]]),
  ]);

/** True when two drafts would start a room with the same bots and limits. */
export function sameLineup(
  a: Pick<AccountDefaults, "bots" | "settings">,
  b: Pick<AccountDefaults, "bots" | "settings">,
) {
  return lineupKey(a) === lineupKey(b);
}
