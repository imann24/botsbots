export type SearchableCommand = {
  id: string;
  label: string;
  description: string;
  keywords?: string;
  shortcut?: string;
  globalShortcut?: string;
  disabled?: string;
  group: "Actions" | "Rooms";
};

export function filterCommands<T extends SearchableCommand>(
  commands: T[],
  query: string,
): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return commands.filter((command) => {
    const haystack =
      `${command.label} ${command.description} ${command.keywords ?? ""}`.toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]',
    )
  );
}

export function shortcutKey(
  event: Pick<
    KeyboardEvent,
    | "key"
    | "metaKey"
    | "ctrlKey"
    | "altKey"
    | "shiftKey"
    | "repeat"
    | "isComposing"
  >,
): string | null {
  if (event.repeat || event.isComposing || event.altKey) return null;
  if (event.metaKey || event.ctrlKey) {
    if (event.shiftKey && event.key.toLowerCase() === "o") return "mod+shift+o";
    if (event.shiftKey && event.key.toLowerCase() === "s") return "mod+shift+s";
    if (event.key === "/" || event.key === "?") return "mod+/";
    if (event.shiftKey) return null;
    if (event.key.toLowerCase() === "k") return "mod+k";
    if (event.key === "Enter") return "mod+enter";
    return null;
  }
  if (event.shiftKey && event.key !== "?") return null;
  return event.key.toLowerCase();
}

export function shortcutLabel(shortcut: string, mac: boolean): string {
  return shortcut
    .split("+")
    .map((key) =>
      key === "mod"
        ? mac
          ? "⌘"
          : "Ctrl"
        : key === "shift"
          ? mac
            ? "⇧"
            : "Shift"
          : key.toUpperCase(),
    )
    .join(mac ? " " : "+");
}
