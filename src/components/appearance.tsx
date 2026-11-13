"use client";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import {
  applyTheme,
  readTheme,
  saveTheme,
  subscribeTheme,
  type Theme,
} from "@/lib/theme";

const serverTheme = (): Theme => "light";

type AppearanceSource = "account" | "header" | "command";

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
  const dark = theme === "dark";
  return {
    dark,
    toggle(source: AppearanceSource) {
      const next = dark ? "light" : "dark";
      trackEvent("appearance_changed", { theme: next, source });
      saveTheme(next);
    },
  };
}

export function AppearanceButton({
  className = "icon-button",
  source = "account",
  iconSize = 17,
}: {
  className?: string;
  source?: Exclude<AppearanceSource, "command">;
  iconSize?: number;
}) {
  const { dark, toggle } = useTheme();
  const Icon = dark ? Sun : Moon;
  return (
    <button
      className={className}
      aria-label="Dark appearance"
      aria-pressed={dark}
      title={dark ? "Switch to light appearance" : "Switch to dark appearance"}
      onClick={() => toggle(source)}
    >
      <Icon size={iconSize} />
    </button>
  );
}

// Strict Mode's development remount resets <html> attributes, clearing the
// value the head script set; production keeps it and this is a no-op.
export function AppearanceSync() {
  useLayoutEffect(() => applyTheme(readTheme()), []);
  return null;
}
