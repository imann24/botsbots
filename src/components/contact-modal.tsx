"use client";
import { trackAction, trackEvent } from "@/lib/analytics";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { contactKinds, type ContactKind } from "@/lib/contact";

export function ContactModal({
  email,
  initialKind,
  onClose,
}: {
  email: string;
  initialKind: ContactKind;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstField = useRef<HTMLSelectElement>(null);
  const sending = useRef(false);
  const [kind, setKind] = useState<ContactKind>(initialKind);
  const [replyTo, setReplyTo] = useState(email);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const limits = kind === "limits";

  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    firstField.current?.focus();
    return () => {
      element?.close();
      if (
        previous instanceof HTMLElement &&
        previous.isConnected &&
        !previous.closest("[inert]")
      )
        previous.focus();
    };
  }, []);

  function close() {
    trackEvent("contact_closed", { kind, sent: status === "sent" });
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setStatus("sending");
    setError("");
    try {
      await trackAction("contact_send", { kind }, async () => {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            email: replyTo.trim(),
            message: message.trim(),
          }),
          signal: AbortSignal.timeout(20000),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error || "Your message couldn’t be sent. Please try again.",
          );
      });
      setStatus("sent");
    } catch (error) {
      setError(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "We couldn’t confirm your message was sent. Please try again.",
      );
      setStatus("idle");
    } finally {
      sending.current = false;
    }
  }

  return (
    <dialog
      ref={dialog}
      className="contact-dialog"
      aria-labelledby="contact-title"
      aria-describedby="contact-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!sending.current) close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !sending.current) close();
      }}
    >
      <div className="contact-surface">
        <header className="contact-heading">
          <div>
            <h2 id="contact-title">
              {status === "sent"
                ? limits
                  ? "Request sent."
                  : "Message sent."
                : "Contact us"}
            </h2>
            <p id="contact-description">
              {status === "sent"
                ? "Thanks for getting in touch."
                : "A question, an idea, or more room to explore."}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Close contact form"
            disabled={status === "sending"}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {status === "sent" ? (
          <div className="contact-success" role="status">
            <Check size={28} aria-hidden="true" />
            <p>
              {limits
                ? "We’ll review your request and reply to"
                : "We’ll reply to"}{" "}
              <strong>{replyTo.trim()}</strong>.
            </p>
            {limits && (
              <p>Your current usage limits stay in place while we review.</p>
            )}
            <button className="button primary" onClick={close}>
              Back to workspace <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <form onSubmit={submit} aria-busy={status === "sending"}>
            <fieldset
              className="contact-fields"
              disabled={status === "sending"}
            >
              <label>
                What can we help with?
                <select
                  ref={firstField}
                  value={kind}
                  onChange={(event) => {
                    const kind = event.target.value as ContactKind;
                    trackEvent("contact_kind_selected", { kind });
                    setKind(kind);
                  }}
                >
                  {Object.entries(contactKinds).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Your email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={replyTo}
                  onChange={(event) => setReplyTo(event.target.value)}
                  aria-describedby="contact-email-help"
                />
                <span className="contact-hint" id="contact-email-help">
                  Where we can reply to you.
                </span>
              </label>
              <label>
                {limits
                  ? "What would you like to do with a higher limit?"
                  : "Your message"}
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={5}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  aria-describedby="contact-message-help"
                  placeholder={
                    limits
                      ? "Tell us about your plans and the weekly allowance you have in mind…"
                      : kind === "feedback"
                        ? "What’s working well? What could be better?"
                        : "Tell us a little more so we can help…"
                  }
                />
              </label>
              <div className="contact-message-meta" id="contact-message-help">
                <span>
                  {limits
                    ? "Requests are reviewed individually."
                    : "Please leave out passwords and API keys."}
                </span>
                <span>{message.length.toLocaleString()} / 5,000</span>
              </div>
            </fieldset>
            {error && (
              <p className="contact-error" role="alert">
                {error}
              </p>
            )}
            <footer className="contact-footer">
              <button
                type="button"
                className="button"
                disabled={status === "sending"}
                onClick={close}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={status === "sending"}
              >
                {status === "sending"
                  ? "Sending…"
                  : limits
                    ? "Send request"
                    : "Send message"}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </footer>
          </form>
        )}
      </div>
    </dialog>
  );
}
