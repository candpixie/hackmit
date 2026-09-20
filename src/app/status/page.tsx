"use client";

/**
 * Live proof that the three sponsor integrations are running.
 *
 * Each row is a real call made when the page loads: the model API is asked
 * which models it serves, the cluster is asked how many documents it holds,
 * and the checkout is given a cart it cannot afford to see whether it refuses.
 * Nothing here is a claim we typed in.
 */

import { useCallback, useEffect, useState } from "react";

type Check = { sponsor: string; what: string; ok: boolean; detail: string; ms: number };
type Health = { checkedAt: string; allOk: boolean; checks: Check[] };

export default function StatusPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(true);

  const run = useCallback(() => {
    setBusy(true);
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then(setHealth)
      .finally(() => setBusy(false));
  }, []);

  useEffect(run, [run]);

  return (
    <main className="mx-auto max-w-[var(--w-page)] px-6 py-16 lg:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
        Live check
      </p>
      <h1 className="mt-6 font-serif text-[46px] leading-[1] tracking-tight text-bone">
        Every integration, called right now.
      </h1>
      <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted">
        Each row below is a real request made when this page loaded. Nothing on it
        is a claim we typed in.
      </p>

      <div className="mt-12 space-y-3">
        {busy && !health
          ? [0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[104px] animate-pulse rounded-lg border border-line bg-card"
              />
            ))
          : health?.checks.map((c) => (
              <div key={c.sponsor} className="rounded-lg border border-line bg-card p-6">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span
                    className={`h-[7px] w-[7px] shrink-0 rounded-full ${
                      c.ok ? "bg-sage" : "bg-ember"
                    }`}
                    aria-hidden
                  />
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone">
                    {c.sponsor}
                  </p>
                  <p className="flex-1 text-[15px] text-muted">{c.what}</p>
                  <p className="font-mono text-[11px] tabular-nums text-faint">{c.ms}ms</p>
                </div>
                <p className="mt-4 pl-[19px] font-serif text-[17px] leading-relaxed text-bone">
                  {c.detail}
                </p>
              </div>
            ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-5">
        <button
          onClick={run}
          disabled={busy}
          className="rounded-md bg-ember px-5 py-2.5 text-[13px] font-medium text-ink disabled:opacity-50"
        >
          {busy ? "Checking…" : "Run the checks again"}
        </button>
        {health ? (
          <p className="font-mono text-[11px] text-faint">
            {new Date(health.checkedAt).toLocaleTimeString()} ·{" "}
            {health.allOk ? "all three responding" : "something is down"}
          </p>
        ) : null}
      </div>

      <p className="mt-12 border-t border-line pt-7 text-[13px] leading-relaxed text-faint">
        Muse is asked which models it will serve. Elasticsearch is asked how many
        documents it holds. Checkout is handed a cart it cannot afford, and passes
        only if it refuses and says why.
      </p>
    </main>
  );
}
