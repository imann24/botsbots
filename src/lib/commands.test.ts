import { describe, expect, it } from "vitest";
import { filterCommands, shortcutKey, shortcutLabel } from "./commands";

const commands = [
  {
    id: "export",
    label: "Export conversation",
    description: "Download as Markdown",
    group: "Actions" as const,
  },
  {
    id: "room",
    label: "Weekend ideas",
    description: "Open room",
    keywords: "tiny adventure budget",
    group: "Rooms" as const,
  },
];
describe("command search", () => {
  it("matches all words across labels, descriptions and room topics", () => {
    expect(
      filterCommands(commands, "  WEEKEND budget ").map((c) => c.id),
    ).toEqual(["room"]);
    expect(
      filterCommands(commands, "download markdown").map((c) => c.id),
    ).toEqual(["export"]);
    expect(filterCommands(commands, "weekend markdown")).toEqual([]);
    expect(filterCommands(commands, "  ")).toEqual(commands);
  });
});
describe("shortcut keys", () => {
  const key = {
    key: "k",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
  };
  it("accepts both platform modifiers and shifted question mark", () => {
    expect(shortcutKey({ ...key, metaKey: true })).toBe("mod+k");
    expect(shortcutKey({ ...key, ctrlKey: true })).toBe("mod+k");
    expect(shortcutKey({ ...key, key: "?", shiftKey: true })).toBe("?");
    expect(shortcutKey({ ...key, key: "N" })).toBe("n");
  });
  it("leaves browser shortcuts, composition and held keys alone", () => {
    for (const modifier of [
      "repeat",
      "isComposing",
      "altKey",
      "shiftKey",
    ] as const)
      expect(shortcutKey({ ...key, [modifier]: true })).toBeNull();
    expect(shortcutKey({ ...key, ctrlKey: true, key: "n" })).toBeNull();
    expect(shortcutKey({ ...key, metaKey: true, shiftKey: true })).toBeNull();
  });
  it("recognizes create-and-start without firing on repeats, IME, or extra modifiers", () => {
    const enter = { ...key, key: "Enter", metaKey: true };
    expect(shortcutKey(enter)).toBe("mod+enter");
    expect(shortcutKey({ ...enter, metaKey: false, ctrlKey: true })).toBe(
      "mod+enter",
    );
    for (const modifier of [
      "repeat",
      "isComposing",
      "altKey",
      "shiftKey",
    ] as const)
      expect(shortcutKey({ ...enter, [modifier]: true })).toBeNull();
    expect(shortcutKey({ ...key, key: "Enter" })).not.toBe("mod+enter");
  });
  it("recognizes navigation chords on both platforms", () => {
    for (const modifier of ["metaKey", "ctrlKey"] as const) {
      expect(
        shortcutKey({ ...key, [modifier]: true, shiftKey: true, key: "O" }),
      ).toBe("mod+shift+o");
      expect(
        shortcutKey({ ...key, [modifier]: true, shiftKey: true, key: "s" }),
      ).toBe("mod+shift+s");
      expect(shortcutKey({ ...key, [modifier]: true, key: "/" })).toBe("mod+/");
    }
    expect(shortcutKey({ ...key, metaKey: true, key: "o" })).toBeNull();
    expect(shortcutKey({ ...key, shiftKey: true, key: "O" })).toBeNull();
    for (const blocked of ["repeat", "isComposing", "altKey"] as const)
      expect(
        shortcutKey({
          ...key,
          metaKey: true,
          shiftKey: true,
          key: "O",
          [blocked]: true,
        }),
      ).toBeNull();
  });
  it("renders platform-appropriate shortcut hints", () => {
    expect(shortcutLabel("mod+shift+o", true)).toBe("⌘ ⇧ O");
    expect(shortcutLabel("mod+shift+o", false)).toBe("Ctrl+Shift+O");
  });
});
