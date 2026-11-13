"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, X } from "lucide-react";

export function ArchiveChatModal({
  title,
  onArchive,
  onClose,
}: {
  title: string;
  onArchive: () => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    cancel.current?.focus();
    return () => {
      element?.close();
      if (
        previous instanceof HTMLElement &&
        previous.isConnected &&
        !previous.closest("[inert]")
      )
        previous.focus();
      else document.querySelector<HTMLButtonElement>(".new-room")?.focus();
    };
  }, []);

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await onArchive();
      onClose();
    } catch (error) {
      setError(
        `Couldn’t archive this chat. ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="contact-dialog archive-dialog"
      aria-labelledby="archive-title"
      aria-describedby="archive-description"
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!inFlight.current) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !inFlight.current)
          onClose();
      }}
    >
      <div>
        <header className="contact-heading">
          <h2 id="archive-title">Archive chat?</h2>
          <button
            className="icon-button"
            aria-label="Close archive confirmation"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="archive-description" id="archive-description">
          <p>
            <strong>{title}</strong> will be hidden from your rooms and search.
            You can restore it anytime from <strong>Archived chats</strong>.
          </p>
          <p>
            New bot replies will pause. Replies already in flight may still
            finish. Your messages and summaries will be kept.
          </p>
        </div>
        {error && (
          <p className="contact-error" role="alert">
            {error}
          </p>
        )}
        <footer className="contact-footer">
          <button
            ref={cancel}
            className="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void confirm()}
          >
            <Archive size={17} aria-hidden="true" />
            {busy ? "Archiving…" : "Archive chat"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
