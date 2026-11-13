import { track, type BeforeSendEvent } from "@vercel/analytics";
import type { RoomDraft, Settings } from "./types";
import type { ContactKind } from "./contact";

// Only aggregate configuration belongs here. Never pass user text, IDs, URLs,
// credentials, API responses, or error messages to analytics.
type RoomContext = {
  purpose: RoomDraft["purpose"];
  mode: Settings["mode"];
  bot_count: number;
};
type ActionData = {
  sign_in: Record<string, never>;
  sign_up: Record<string, never>;
  sign_out: Record<string, never>;
  room_create: RoomContext & { start_immediately: boolean };
  room_update: RoomContext & { start_immediately: boolean };
  room_start: { mode: Settings["mode"]; source: "control" | "create" };
  room_pause: { mode: Settings["mode"] };
  room_stop: { mode: Settings["mode"] };
  room_rename: Record<string, never>;
  room_archive: Record<string, never>;
  room_restore: Record<string, never>;
  message_send: {
    mode: Settings["mode"];
    room_status: string;
    length_bucket: string;
  };
  defaults_save: RoomContext;
  defaults_reset: Record<string, never>;
  contact_send: { kind: ContactKind };
};
type EventData = {
  auth_mode_changed: { mode: "sign_in" | "sign_up" };
  auth_validation_failed: { reason: "password_mismatch" };
  room_draft_opened: { custom_defaults: boolean };
  room_opened: { source: "navigation" | "command"; filtered?: boolean };
  room_editor_opened: Record<string, never>;
  room_editor_cancelled: Record<string, never>;
  room_purpose_selected: { purpose: RoomDraft["purpose"] };
  room_prompt_applied: { purpose: RoomDraft["purpose"] };
  room_start_blocked: { reason: "account_limit" };
  room_archive_prompted: Record<string, never>;
  room_archive_cancelled: Record<string, never>;
  room_rename_opened: Record<string, never>;
  room_rename_cancelled: Record<string, never>;
  room_exported: { message_count: number; format: "markdown" };
  archive_view_changed: { open: boolean };
  room_search_used: { scope: "active" | "archived"; result_count: number };
  bot_added: { model: string; bot_count: number };
  bot_removed: { model: string; bot_count: number };
  bot_details_toggled: { open: boolean; model: string };
  bot_model_selected: { model: string };
  bot_field_edited: { field: "name" | "perspective" };
  room_setting_changed: {
    setting: keyof Settings;
    value: number | Settings["mode"];
  };
  panel_toggled: {
    panel: "nav" | "setup" | "limits" | "summary";
    open: boolean;
    layout: "desktop" | "drawer" | "inline";
  };
  latest_replies_clicked: Record<string, never>;
  usage_viewed: Record<string, never>;
  usage_details_toggled: { open: boolean };
  usage_retry_clicked: Record<string, never>;
  room_help_toggled: { open: boolean };
  summary_model_selected: { model: string };
  summary_history_toggled: { open: boolean };
  summary_selected: { model: string; status: string };
  summary_generate_started: { model: string };
  summary_generate_succeeded: { model: string };
  summary_generate_pending: { model: string };
  summary_generate_failed: { model: string; reason: "generation" | "request" };
  contact_opened: { kind: ContactKind };
  contact_kind_selected: { kind: ContactKind };
  contact_closed: { kind: ContactKind; sent: boolean };
  command_bar_opened: { source: "button" | "keyboard"; shortcuts: boolean };
  command_executed: {
    command: string;
    source: "palette" | "shortcut";
    filtered: boolean;
  };
  command_search_used: { result_count: number };
  shortcuts_viewed: Record<string, never>;
  hotkeys_changed: { enabled: boolean };
};

function emit(name: string, data: object) {
  if (typeof window === "undefined") return;
  try {
    // Vercel accepts flat primitive properties, each at most 255 characters.
    const properties = Object.fromEntries(
      Object.entries(data).filter(
        ([key, value]) =>
          key.length <= 255 &&
          (typeof value === "boolean" ||
            (typeof value === "number" && Number.isFinite(value)) ||
            (typeof value === "string" && value.length <= 255)),
      ),
    );
    track(name, properties);
  } catch {
    // Telemetry must never prevent an interaction or turn success into failure.
  }
}

export function trackEvent<K extends keyof EventData>(
  name: K,
  data: EventData[K],
) {
  emit(name, data);
}

// Wrap only the actual operation, not subsequent refreshes. A refresh failure
// must not report a successful write as failed. Retries are separate attempts.
export async function trackAction<K extends keyof ActionData, T>(
  name: K,
  data: ActionData[K],
  operation: () => Promise<T>,
): Promise<T> {
  emit(`${name}_started`, data);
  try {
    const result = await operation();
    emit(`${name}_succeeded`, data);
    return result;
  } catch (error) {
    emit(`${name}_failed`, { ...data, error_type: errorType(error) });
    throw error;
  }
}

function errorType(error: unknown): string {
  // Deliberately avoid error.message, provider codes, or arbitrary error names.
  if (error instanceof Error && error.name === "TimeoutError") return "timeout";
  if (error instanceof Error && error.name === "AbortError") return "aborted";
  if (error instanceof TypeError) return "network_or_client";
  return "request";
}

export function roomAnalytics(
  room: Pick<RoomDraft, "purpose" | "settings" | "bots">,
): RoomContext {
  return {
    purpose: room.purpose,
    mode: room.settings.mode,
    bot_count: room.bots.length,
  };
}

export function lengthBucket(length: number) {
  return length <= 100
    ? "1-100"
    : length <= 500
      ? "101-500"
      : length <= 2000
        ? "501-2000"
        : "2001+";
}

export function redactAnalyticsUrl(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    // Room IDs live in the query string. Strip query/hash from pageviews AND events.
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
