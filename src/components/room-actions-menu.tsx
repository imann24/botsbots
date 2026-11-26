"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Archive, Download, Ellipsis, FileText } from "lucide-react";

export function RoomActionsMenu({
  triggerRef,
  summaryOpen,
  busy,
  onSummarize,
  onExport,
  onArchive,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  summaryOpen: boolean;
  busy: boolean;
  onSummarize: () => void;
  onExport: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const firstFocus = useRef<"first" | "last">("first");
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const items = menu.current?.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    items?.[firstFocus.current === "last" ? items.length - 1 : 0]?.focus();
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function run(action: () => void) {
    close();
    action();
  }

  return (
    <div
      className="room-actions"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="icon-button room-actions-trigger"
        title="Conversation actions"
        aria-label="Conversation actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          firstFocus.current = "first";
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            firstFocus.current = event.key === "ArrowUp" ? "last" : "first";
            setOpen(true);
          }
        }}
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          className="room-actions-menu"
          role="menu"
          aria-label="Conversation actions"
          onKeyDown={(event) => {
            // Keep workspace shortcuts from running while navigating the menu.
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
              close();
              return;
            }
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            );
            const current = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : event.key === "ArrowDown"
                    ? (current + 1) % items.length
                    : event.key === "ArrowUp"
                      ? (current - 1 + items.length) % items.length
                      : -1;
            if (next >= 0) {
              event.preventDefault();
              items[next]?.focus();
            }
          }}
        >
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-expanded={summaryOpen}
            aria-controls="conversation-summary"
            onClick={() => run(onSummarize)}
          >
            <FileText size={16} aria-hidden="true" /> Summarize
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => run(onExport)}
          >
            <Download size={16} aria-hidden="true" /> Export
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={busy}
            aria-haspopup="dialog"
            onClick={() => run(onArchive)}
          >
            <Archive size={16} aria-hidden="true" /> Archive
          </button>
        </div>
      )}
    </div>
  );
}
