"use client";

import { useState } from "react";
import type { CloseView, Report } from "@/lib/types";

/**
 * The counterweight to the overdue list. Six factors shown separately, each
 * with the number behind it, because a single "97% best friend" is a claim
 * nobody can check and this whole project refuses to make one.
 */
export function Closest({ report, onBack }: { report: Report; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(report.closest[0]?.thread ?? null);

  if (!report.closest?.length) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <button onClick={onBack} className="text-[11px] text-faint hover:text-bone">
          Back to the list
        </button>
        <p className="mt-8 text-[15px] text-muted">
          Not enough history in these conversations to rank anyone honestly.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[var(--w-page)] px-6 py-12 lg:px-10">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          Closest
        </p>
        <button onClick={onBack} className="text-[11px] text-faint hover:text-bone">
          Back to the list
        </button>
      </div>

      <h1 className="mt-5 font-serif text-4xl leading-tight text-bone">
        Who you are actually closest to.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        Not who you message most. The person you message most is often a group
        project. Six things are scored separately, and you can see every one of them.
      </p>

      <ol className="mt-10 space-y-2">
        {report.closest.map((c, i) => (
          <li key={c.thread}>
            <Row
              close={c}
              rank={i + 1}
              open={open === c.thread}
              onToggle={() => setOpen(open === c.thread ? null : c.thread)}
            />
          </li>
        ))}
      </ol>

      <p className="mt-10 border-t border-line pt-7 text-[13px] leading-relaxed text-faint">
        Scored from message counts, lengths, timestamps and phrasing. No model decides
        who your friends are, and nothing here is a percentage of anything.
      </p>
    </main>
  );
}

function Row({
  close,
  rank,
  open,
  onToggle,
}: {
  close: CloseView;
  rank: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-lg border transition-colors ${
        open ? "border-line bg-card" : "border-transparent hover:border-line hover:bg-ink-soft"
      }`}
    >
      <button onClick={onToggle} className="w-full px-5 py-4 text-left">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[11px] text-faint">
            {String(rank).padStart(2, "0")}
          </span>
          <span className="flex-1 truncate text-[15px] text-bone">{close.friend}</span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-faint">
            {close.totalMessages.toLocaleString()} msgs
          </span>
        </div>

        <p className="mt-1.5 pl-[28px] text-[13px] text-muted">{close.headline}</p>

        {/* Six bars, so the shape of a friendship is visible at a glance. */}
        <div className="mt-3 flex gap-1 pl-[28px]">
          {close.factors.map((f) => (
            <div key={f.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-ember"
                style={{ width: `${Math.max(f.score * 100, 2)}%` }}
              />
            </div>
          ))}
        </div>
      </button>

      {open ? (
        <div className="rise border-t border-line px-5 py-5">
          <dl className="space-y-3.5">
            {close.factors.map((f) => (
              <div key={f.key} className="grid grid-cols-[130px_40px_1fr] items-baseline gap-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                  {f.label}
                </dt>
                <dd className="font-mono text-[11px] tabular-nums text-bone">
                  {Math.round(f.score * 100)}
                </dd>
                <dd className="text-[13px] leading-relaxed text-muted">{f.detail}</dd>
              </div>
            ))}
          </dl>

          {close.exhibit ? (
            <blockquote className="mt-6 border-l-2 border-ember/40 pl-4">
              <p className="font-serif text-[17px] leading-snug text-bone">
                {close.exhibit.text}
              </p>
              <footer className="mt-2 font-mono text-[11px] text-faint">
                {close.exhibit.sender} ·{" "}
                {new Date(close.exhibit.ts).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </footer>
            </blockquote>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
