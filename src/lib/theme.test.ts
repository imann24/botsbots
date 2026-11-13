import { describe, expect, it } from "vitest";
import { parseTheme, THEME_STORAGE_KEY, themeScript } from "./theme";

function runScript(stored: string | null, storageFails = false) {
  const attributes: Record<string, string> = {};
  const localStorage = {
    getItem(key: string) {
      if (storageFails) throw new Error("blocked");
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  const document = {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
    },
  };
  new Function("localStorage", "document", themeScript)(localStorage, document);
  return attributes["data-theme"];
}

describe("theme preference", () => {
  it("defaults to light for anything other than a saved dark choice", () => {
    expect(parseTheme("dark")).toBe("dark");
    for (const value of ["light", "system", null, undefined, ""])
      expect(parseTheme(value)).toBe("light");
  });

  it("applies a saved dark theme before paint and leaves light untouched", () => {
    expect(runScript("dark")).toBe("dark");
    expect(runScript("light")).toBeUndefined();
    expect(runScript(null)).toBeUndefined();
    expect(runScript("dark", true)).toBeUndefined();
  });
});
