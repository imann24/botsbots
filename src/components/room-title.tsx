"use client";

import { useRef, useState, type FormEvent } from "react";
import { Check, Pencil, X } from "lucide-react";

export function RoomTitle({
  title,
  onRename,
}: {
  title: string;
  onRename: (title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function close() {
    setEditing(false);
    setError("");
    requestAnimationFrame(() => trigger.current?.focus());
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || inFlight.current) return;
    if (value.trim() === title) return close();
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await onRename(value.trim());
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="room-title">
      {editing ? (
        <form
          className="room-title-editor"
          onSubmit={save}
          aria-label="Rename conversation"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !inFlight.current) {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className="room-title-controls">
            <input
              aria-label="Conversation title"
              aria-describedby={error ? "room-title-error" : undefined}
              aria-invalid={!!error}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              value={value}
              maxLength={80}
              required
              disabled={saving}
              onChange={(event) => setValue(event.target.value)}
            />
            <button
              className="icon-button"
              aria-label={saving ? "Saving title" : "Save title"}
              title="Save title"
              disabled={saving || !value.trim()}
            >
              <Check size={17} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Cancel rename"
              title="Cancel rename"
              disabled={saving}
              onClick={close}
            >
              <X size={17} />
            </button>
          </div>
          {error && (
            <p id="room-title-error" className="room-title-error" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <>
          <span className="room-title-text" title={title}>
            {title}
          </span>
          <button
            ref={trigger}
            className="icon-button"
            aria-label="Rename conversation"
            title="Rename conversation"
            onClick={() => {
              setValue(title);
              setError("");
              setEditing(true);
            }}
          >
            <Pencil size={15} />
          </button>
        </>
      )}
    </div>
  );
}
