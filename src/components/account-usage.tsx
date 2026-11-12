"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { usageLevel, usageMoney, type AccountUsage } from "../lib/usage";

export function useAccountUsage() {
  const [usage, setUsage] = useState<AccountUsage | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    // Polling must not keep cancelling a slow request before its timeout fires.
    if (inFlight.current && !inFlight.current.signal.aborted) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    try {
      const response = await fetch("/api/usage", {
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(10000),
        ]),
      });
      if (!response.ok) throw new Error("Usage unavailable");
      const data = await response.json();
      if (!controller.signal.aborted) {
        setUsage(data.usage);
        setError(false);
      }
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, []);
  useEffect(() => {
    void refresh();
    const visibleRefresh = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(visibleRefresh, 5000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", visibleRefresh);
      document.removeEventListener("visibilitychange", visibleRefresh);
      inFlight.current?.abort();
    };
  }, [refresh]);
  useEffect(() => {
    if (!usage) return;
    const delay = Date.parse(usage.resetsAt) - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(() => void refresh(), delay + 100);
    return () => clearTimeout(timer);
  }, [usage, refresh]);
  return { usage, error, loading, refresh };
}

export function AccountUsageMeter({
  usage,
  error,
  loading,
  onRefresh,
}: {
  usage: AccountUsage | null;
  error: boolean;
  loading: boolean;
  onRefresh: () => void;
}) {
  const level = usage ? usageLevel(usage) : "normal";
  const resetDate = usage
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(usage.resetsAt))
    : "";
  return (
    <section
      className={`account-usage ${level}`}
      aria-label="Weekly account usage"
      id="weekly-usage"
      tabIndex={-1}
    >
      {!usage ? (
        <div className="usage-placeholder">
          <span>This week</span>
          <p role="status">
            {error ? "Usage is unavailable." : "Loading usage…"}
          </p>
        </div>
      ) : (
        <>
          <details className="usage-details">
            <summary title="Weekly usage details">
              <span className="usage-heading">
                <span>This week</span>
                <span className="usage-amount">
                  <strong>{usageMoney(usage.used)}</strong>
                  {usage.limit === null ? (
                    " used"
                  ) : (
                    <> / {usageMoney(usage.limit)}</>
                  )}
                </span>
                <ChevronDown
                  className="usage-chevron"
                  size={12}
                  aria-hidden="true"
                />
              </span>
              {usage.limit !== null && (
                <progress
                  max={usage.limit || 1}
                  value={
                    usage.limit === 0 ? 1 : Math.min(usage.used, usage.limit)
                  }
                  aria-label="Weekly account allowance used"
                  aria-valuetext={`${usageMoney(usage.used)} of ${usageMoney(usage.limit)} used`}
                />
              )}
              <span className="usage-meta">
                <span>
                  {usage.remaining === null
                    ? "No weekly limit"
                    : `${usageMoney(usage.remaining)} left`}
                </span>
                <span>
                  {usage.limit === null ? "Premium" : `Resets ${resetDate}`}
                </span>
              </span>
            </summary>
            <div className="usage-breakdown">
              <div className="usage-plan">
                <span>
                  {usage.tier === "premium" ? "Premium" : "Standard"} plan
                </span>
                <span>USD</span>
              </div>
              <dl>
                <div>
                  <dt>Recorded spend</dt>
                  <dd>{usageMoney(usage.spent)}</dd>
                </div>
                {usage.pending > 0 && (
                  <div>
                    <dt>In progress</dt>
                    <dd>{usageMoney(usage.pending)}</dd>
                  </div>
                )}
                {usage.uncertain > 0 && (
                  <div>
                    <dt>Uncertain requests</dt>
                    <dd>{usageMoney(usage.uncertain)}</dd>
                  </div>
                )}
              </dl>
              <p>
                Estimated AI costs across all rooms and summaries, not charges
                to you.
              </p>
              {usage.pending + usage.uncertain > 0 && (
                <p>
                  Pending and uncertain requests reserve allowance before their
                  final cost is known.
                </p>
              )}
              {usage.uncertain > 0 && (
                <p>
                  Uncertain requests may have been billed by the provider, so
                  their reservation is held.
                </p>
              )}
              <p>
                {usage.limit === null ? "New week" : "Resets"} {resetDate} at
                00:00 UTC. Weeks begin Monday
                {usage.limit === null
                  ? "."
                  : "; unused allowance does not roll over."}{" "}
                Room limits still apply.
              </p>
            </div>
          </details>
          {level === "warning" && (
            <p className="usage-warning" role="status">
              Approaching your weekly limit.
            </p>
          )}
          {level === "exhausted" && (
            <p className="usage-warning" role="status">
              {usage.limit === 0
                ? "Your allowance is $0. Replies resume when your allowance changes."
                : "Weekly allowance used. Replies pause until it resets or changes."}
            </p>
          )}
        </>
      )}
      {error && (
        <div className="usage-error" role="status">
          {usage && (
            <p>Couldn’t refresh usage. These figures may be out of date.</p>
          )}
          <button type="button" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={13} aria-hidden="true" />{" "}
            {loading ? "Refreshing…" : "Retry usage"}
          </button>
        </div>
      )}
    </section>
  );
}
