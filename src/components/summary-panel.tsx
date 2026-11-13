"use client";
import { useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ENABLED_MODEL_CHOICES, modelInfo } from "@/lib/models";
import { agentClass, agentColors } from "@/lib/agent-colors";
import type { Message, Room } from "@/lib/types";
import type { Summary } from "@/lib/summary";
import { ModelLabel, ModelSelect, ProviderIcon } from "./model-identity";
import { parseSummaryContent } from "@/lib/summary-content";

export function SummaryPanel({
  room,
  messages,
  summaries,
  accountExhausted = false,
  onRefresh,
  onClose,
}: {
  room: Room;
  messages: Message[];
  summaries: Summary[];
  accountExhausted?: boolean;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}) {
  const [model, setModel] = useState(() => {
    const last = summaries[0]?.model;
    return last && ENABLED_MODEL_CHOICES.some((m) => m.id === last)
      ? last
      : ENABLED_MODEL_CHOICES[0].id;
  });
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<{ id: string; model: string } | null>(null),
    inFlight = useRef(false);
  const expired = (s: Summary) =>
    s.status === "pending" && Date.now() - Date.parse(s.created_at) > 120000;
  const pending = summaries.some((s) => s.status === "pending" && !expired(s));
  const summary = summaries.find((s) => s.id === selected) ?? summaries[0];
  const structured = summary ? parseSummaryContent(summary.content) : null;
  const colors = agentColors(room.bots, [
    ...messages.map((m) => m.bot_id),
    ...(structured?.contributions.map((c) => c.botId) ?? []),
  ]);
  const newer = summary
    ? messages.filter(
        (m) =>
          m.status === "complete" &&
          m.content.trim() &&
          !summary.source_ids.includes(m.id),
      ).length
    : 0;
  async function generate() {
    if (inFlight.current || pending || accountExhausted) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setSelected("");
    if (!request.current || request.current.model !== model)
      request.current = { id: crypto.randomUUID(), model };
    try {
      const response = await fetch(`/api/rooms/${room.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, requestId: request.current.id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Summary failed. Try again manually.");
      request.current = null;
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="summary-panel"
      id="conversation-summary"
      aria-labelledby="summary-heading"
    >
      <div className="summary-heading">
        <h2 id="summary-heading">
          <FileText size={17} /> Conversation summary
        </h2>
        <button
          className="icon-button"
          aria-label="Close summary"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="summary-controls">
        <label>
          Summary model
          <ModelSelect
            autoFocus
            value={model}
            disabled={busy || pending}
            onChange={(e) => setModel(e.target.value)}
          />
        </label>
        <button
          className="button primary small"
          disabled={
            busy ||
            accountExhausted ||
            pending ||
            !messages.some(
              (m) => m.bot_id && m.status === "complete" && m.content.trim(),
            )
          }
          onClick={() => void generate()}
        >
          {busy || pending ? "Summarizing…" : "Generate summary"}
        </button>
      </div>
      <p className="summary-help">
        Only runs when you click Generate summary. Cost counts toward your room
        budget and weekly account allowance.
      </p>
      {accountExhausted && (
        <p className="reply-error">
          Your weekly allowance is used. Saved summaries remain available.
        </p>
      )}
      {error && (
        <p className="reply-error" role="alert">
          {error}
        </p>
      )}
      {(busy || pending) && (
        <p className="summary-help" role="status">
          Preparing a concise synthesis… You can keep chatting.
        </p>
      )}
      {summaries.length > 1 && (
        <details className="summary-history">
          <summary>Saved summaries ({summaries.length})</summary>
          <label>
            View saved summary
            <span className="model-select">
              <ProviderIcon model={summary?.model ?? model} />
              <select
                value={summary?.id ?? ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                {summaries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.created_at).toLocaleString()} ·{" "}
                    {modelInfo(s.model).name} · {s.source_count} messages
                  </option>
                ))}
              </select>
            </span>
          </label>
        </details>
      )}
      {summary && (
        <div className="summary-result">
          <p className="summary-meta">
            <ModelLabel model={summary.model} /> · {summary.source_count}{" "}
            messages ·{" "}
            <time dateTime={summary.created_at}>
              {new Date(summary.created_at).toLocaleString()}
            </time>
          </p>
          {summary.status === "failed" || expired(summary) ? (
            <p className="reply-error">
              {summary.error ??
                "Summary timed out. Its budget reservation is retained. Try again manually."}
            </p>
          ) : summary.status === "complete" ? (
            <>
              {structured ? (
                <div className="summary-contributions">
                  {structured.contributions.map((part, i) => (
                    <section
                      className={`summary-contribution ${agentClass(colors, part.botId)}`}
                      key={`${part.botId}:${part.model}:${i}`}
                    >
                      <h3>
                        <span
                          className={`avatar ${agentClass(colors, part.botId)}`}
                          aria-hidden="true"
                        >
                          {part.speaker.replace(/^The /, "")[0]?.toUpperCase()}
                        </span>
                        <span>
                          {part.speaker}
                          <small>
                            <ModelLabel model={part.model} />
                          </small>
                        </span>
                      </h3>
                      <p>{part.text}</p>
                    </section>
                  ))}
                  <section className="summary-synthesis">
                    <h3>Combined synthesis</h3>
                    <p>{structured.synthesis}</p>
                  </section>
                </div>
              ) : (
                <div className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {summary.content}
                  </ReactMarkdown>
                </div>
              )}
              {summary.finish_reason === "length" && (
                <p className="reply-error">
                  This summary reached its output limit and may be incomplete.
                </p>
              )}
            </>
          ) : null}
          {newer > 0 && (
            <p className="summary-help">
              {newer} newer completed{" "}
              {newer === 1 ? "message is" : "messages are"} not included. Click
              Generate summary when you want an updated synthesis.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
