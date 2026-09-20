"use client";

import { useState } from "react";
import type { Report, TieView } from "@/lib/types";

type Props = {
  report: Report;
  selected: TieView | null;
  onSelect: (tie: TieView) => void;
  onGroup: () => void;
  onReset: () => void;
};

/** Dormant is the interesting bucket; warm ties are shown so the ranking is falsifiable. */
function bucket(tie: TieView): "dormant" | "slipping" | "warm" {
  if (tie.decay >= 0.45) return "dormant";
  if (tie.decay >= 0.15) return "slipping";
  return "warm";
}

const TONE = {
  dormant: "text-ember",
  slipping: "text-bone",
  warm: "text-sage",
} as const;

const SHOWN = 20;

export function Ranking({ report, selected, onSelect, onGroup, onReset }: Props) {
  const [all, setAll] = useState(false);
  const dormant = report.ties.filter((t) => bucket(t) === "dormant").length;
  // Four hundred rows is a scroll, not a list. Show the ones worth acting on.
  const visible = all ? report.ties : report.ties.slice(0, SHOWN);

  return (
    <aside className="lg:sticky lg:top-12 lg:self-start">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">
          Overdue
        </p>
        <button
          onClick={onReset}
          className="text-[12px] text-faint transition-colors hover:text-bone"
        >
          Start over
        </button>
      </div>

      <h1 className="mt-5 font-serif text-4xl leading-tight text-bone">
        {dormant} {dormant === 1 ? "friendship is" : "friendships are"} going quiet.
      </h1>

      <p className="mt-3 text-[13px] leading-relaxed text-faint">
        {report.messageCount.toLocaleString()} messages across{" "}
        {report.threadCount.toLocaleString()}{" "}
        {report.threadCount === 1 ? "conversation" : "conversations"}, read as{" "}
        {report.owner}.{report.sample ? " Sample archive." : ""}
      </p>

      <button
        onClick={onGroup}
        className="mt-7 w-full rounded-lg border border-line bg-card px-4 py-3.5 text-left transition-colors hover:border-ember"
      >
        <span className="text-[14px] text-bone">Get them all in one room</span>
        <span className="mt-1 block text-[12px] leading-relaxed text-faint">
          Search every thread at once for the thing they'd all actually want.
        </span>
      </button>

      <ol className="mt-7 space-y-1">
        {visible.map((tie, i) => {
          const active = selected?.thread === tie.thread;
          const tone = TONE[bucket(tie)];

          return (
            <li key={tie.thread}>
              <button
                onClick={() => onSelect(tie)}
                className={`group w-full rounded-lg border px-4 py-4 text-left transition-colors ${
                  active
                    ? "border-line bg-card"
                    : "border-transparent hover:border-line hover:bg-ink-soft"
                }`}
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 truncate text-[15px] text-bone">
                    {tie.friend}
                  </span>
                  <span className={`font-mono text-[11px] tabular-nums ${tone}`}>
                    {tie.silenceDays}d
                  </span>
                </div>

                <p className="mt-2 pl-[26px] text-[13px] leading-snug text-muted">
                  {tie.headline}
                </p>

                <div className="mt-3 ml-[26px] h-[3px] overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full ${
                      bucket(tie) === "warm" ? "bg-sage" : "bg-ember"
                    }`}
                    style={{ width: `${Math.max(tie.decay * 100, 2)}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {report.ties.length > SHOWN ? (
        <button
          onClick={() => setAll((v) => !v)}
          className="mt-5 w-full rounded-lg border border-line py-3 text-[13px] text-faint transition-colors hover:border-faint hover:text-bone"
        >
          {all
            ? `Show the ${SHOWN} most overdue`
            : `Show all ${report.ties.length.toLocaleString()} conversations`}
        </button>
      ) : null}
    </aside>
  );
}
