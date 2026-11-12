"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Keyboard,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  filterCommands,
  isTypingTarget,
  shortcutKey,
  shortcutLabel,
  type SearchableCommand,
} from "@/lib/commands";

export type WorkspaceCommand = SearchableCommand & {
  icon: LucideIcon;
  run: () => void;
};

export function CommandBar({
  commands,
  onOpen,
  shortcutsBlocked,
}: {
  commands: WorkspaceCommand[];
  onOpen: () => void;
  shortcutsBlocked: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mac, setMac] = useState(false);
  const [hotkeysEnabled, setHotkeysEnabled] = useState(true);
  const help = query.trim() === "?";
  const results = help
    ? commands.filter((command) => command.shortcut || command.globalShortcut)
    : filterCommands(commands, query);
  const selected =
    results.find((command) => command.id === selectedId) ??
    results.find((command) => !command.disabled) ??
    results[0];
  const optionId = (id: string) => `command-${id}`;

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    try {
      setHotkeysEnabled(localStorage.getItem("botsbots:hotkeys") !== "off");
    } catch {
      /* Storage is optional. */
    }
  }, []);

  function close(restoreFocus = true) {
    dialog.current?.close();
    setOpen(false);
    if (restoreFocus) {
      const target = previousFocus.current;
      if (target?.isConnected && !target.closest("[inert]")) target.focus();
      else trigger.current?.focus();
    }
  }

  function show(shortcuts = false) {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    onOpen();
    setQuery(shortcuts ? "?" : "");
    setSelectedId(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    input.current?.focus();
  }, [open]);

  function execute(command: WorkspaceCommand | undefined) {
    if (!command || command.disabled) return;
    close();
    // Let drawers and the dialog release focus before the destination takes it.
    requestAnimationFrame(command.run);
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const key = shortcutKey(event);
      if (key === "mod+k") {
        event.preventDefault();
        if (open) close();
        else show();
        return;
      }
      if (key === "mod+/") {
        event.preventDefault();
        if (open) {
          setQuery("?");
          setSelectedId(null);
          input.current?.focus();
        } else show(true);
        return;
      }
      const globalCommand = commands.find(
        (item) => item.globalShortcut === key,
      );
      if (globalCommand) {
        event.preventDefault();
        if (!globalCommand.disabled) {
          onOpen(); // Release drawer focus before navigating.
          if (open) execute(globalCommand);
          else requestAnimationFrame(globalCommand.run);
        }
        return;
      }
      if (
        open ||
        shortcutsBlocked ||
        !hotkeysEnabled ||
        isTypingTarget(event.target)
      )
        return;
      if (key === "?") {
        event.preventDefault();
        show(true);
        return;
      }
      const command = commands.find(
        (item) => item.shortcut?.toLowerCase() === key,
      );
      if (command && !command.disabled) {
        event.preventDefault();
        command.run();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  useEffect(() => {
    if (open && selected)
      document
        .getElementById(optionId(selected.id))
        ?.scrollIntoView({ block: "nearest" });
  }, [open, selected?.id]);

  return (
    <>
      <button
        ref={trigger}
        className="button small command-trigger"
        type="button"
        aria-label="Open command bar"
        aria-keyshortcuts="Meta+K Control+K"
        aria-haspopup="dialog"
        title={`Search rooms and actions (${mac ? "Cmd" : "Ctrl"}+K)`}
        onClick={() => show()}
      >
        <Search size={16} />
        <span>Search</span>
        <kbd>{mac ? "⌘" : "Ctrl"} K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        aria-labelledby="command-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="command-surface">
          <div className="command-heading">
            <h2 id="command-title">
              {help ? "Keyboard shortcuts" : "Command bar"}
            </h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Close command bar"
              onClick={() => close()}
            >
              <X size={18} />
            </button>
          </div>
          <div className="command-search">
            <Search size={20} aria-hidden="true" />
            <input
              ref={input}
              role="combobox"
              aria-label="Search rooms and actions"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls="command-results"
              aria-activedescendant={
                selected ? optionId(selected.id) : undefined
              }
              placeholder="Search rooms and actions…"
              value={query}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId(null);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const index = results.findIndex(
                    (command) => command.id === selected?.id,
                  );
                  const next =
                    (index +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      results.length) %
                    results.length;
                  setSelectedId(results[next]?.id ?? null);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  if (!event.repeat) execute(selected);
                }
              }}
            />
            {query && (
              <button
                className="icon-button"
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  input.current?.focus();
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          {help && (
            <div className="command-help">
              <p>
                <kbd>{mac ? "⌘" : "Ctrl"} K</kbd> opens this bar from anywhere.{" "}
                <kbd>{mac ? "⌘" : "Ctrl"} /</kbd> shows shortcuts.
              </p>
              <p>
                Single-key shortcuts work when you’re not typing. In a message,
                Enter sends and Shift + Enter adds a new line.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={hotkeysEnabled}
                  onChange={(event) => {
                    setHotkeysEnabled(event.target.checked);
                    try {
                      localStorage.setItem(
                        "botsbots:hotkeys",
                        event.target.checked ? "on" : "off",
                      );
                    } catch {
                      /* Storage is optional. */
                    }
                  }}
                />
                Enable single-key shortcuts
              </label>
            </div>
          )}
          <div
            id="command-results"
            role="listbox"
            aria-label={help ? "Keyboard shortcuts" : "Rooms and actions"}
            className="command-results"
          >
            {(["Actions", "Rooms"] as const).map((group) => {
              const items = results.filter(
                (command) => command.group === group,
              );
              if (!items.length) return null;
              return (
                <div role="group" aria-label={group} key={group}>
                  <div className="command-group-label" aria-hidden="true">
                    {group === "Rooms" && !query ? "Your rooms" : group}
                  </div>
                  {items.map((command) => (
                    <div
                      key={command.id}
                      id={optionId(command.id)}
                      role="option"
                      aria-selected={selected?.id === command.id}
                      aria-disabled={!!command.disabled}
                      className={`command-option ${selected?.id === command.id ? "selected" : ""}`}
                      onPointerMove={() => setSelectedId(command.id)}
                      onClick={() => execute(command)}
                    >
                      <command.icon size={18} aria-hidden="true" />
                      <span className="command-copy">
                        <b>{command.label}</b>
                        <small>{command.disabled || command.description}</small>
                      </span>
                      {command.globalShortcut ? (
                        <kbd>{shortcutLabel(command.globalShortcut, mac)}</kbd>
                      ) : (
                        command.shortcut && <kbd>{command.shortcut}</kbd>
                      )}
                      {selected?.id === command.id && !command.disabled && (
                        <CornerDownLeft
                          className="command-return"
                          size={15}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            {!results.length && (
              <div className="command-empty">
                <Search size={24} />
                <b>No matches for “{query}”</b>
                <p>Try a room name or an action like “export” or “setup”.</p>
                <button
                  className="button small"
                  onClick={() => {
                    setQuery("");
                    input.current?.focus();
                  }}
                >
                  Show all actions
                </button>
              </div>
            )}
          </div>
          <span className="sr-only" role="status">
            {results.length} results
          </span>
          <footer className="command-footer">
            <span>
              <ArrowUp size={12} />
              <ArrowDown size={12} /> navigate <CornerDownLeft size={13} />{" "}
              select <kbd>Esc</kbd> close
            </span>
            <button
              className="text-button"
              onClick={() => {
                setQuery(help ? "" : "?");
                setSelectedId(null);
                input.current?.focus();
              }}
            >
              <Keyboard size={15} />
              {help ? "All actions" : "Shortcuts"}
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
