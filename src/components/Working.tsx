"use client";

/**
 * Feedback for a call that takes tens of seconds.
 *
 * muse-spark-1.3 spends most of its budget reasoning, so a draft is about
 * twenty seconds and a group plan about forty. A button that says "Writing…"
 * for forty seconds is indistinguishable from a hung app, so this names the
 * step that is actually running and keeps something moving.
 *
 * The steps are paced from measured runs. They describe real work in the real
 * order; none of them is a progress bar pretending to know a percentage.
 */

import { useEffect, useState } from "react";

export function Working({ steps, note }: { steps: [string, number][]; note?: string }) {
  const [at, setAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timers = steps.map(([, ms], i) => setTimeout(() => setAt(i), ms));
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(tick);
    };
  }, [steps]);

  return (
    <div className="rounded-lg border border-line bg-card px-5 py-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex gap-[3px]" aria-hidden>
          <i className="h-[3px] w-[3px] rounded-full bg-ember [animation:blink_1.2s_ease-in-out_infinite]" />
          <i className="h-[3px] w-[3px] rounded-full bg-ember [animation:blink_1.2s_ease-in-out_infinite] [animation-delay:160ms]" />
          <i className="h-[3px] w-[3px] rounded-full bg-ember [animation:blink_1.2s_ease-in-out_infinite] [animation-delay:320ms]" />
        </span>
        <p className="flex-1 font-mono text-[11px] uppercase tracking-[0.2em] text-bone">
          {steps[at]?.[0] ?? steps[0][0]}
        </p>
        <p className="font-mono text-[10px] tabular-nums text-faint">{elapsed}s</p>
      </div>

      <div className="mt-3 h-[2px] w-full overflow-hidden rounded-full bg-line">
        <div className="h-full w-1/4 rounded-full bg-ember/70 [animation:slide_1.4s_ease-in-out_infinite]" />
      </div>

      {note ? <p className="mt-3 text-[11px] leading-relaxed text-faint">{note}</p> : null}
    </div>
  );
}

/** Measured against muse-spark-1.3 on a real archive. */
export const DRAFT_STEPS: [string, number][] = [
  ["Reading the evidence", 0],
  ["Muse is thinking", 3000],
  ["Writing the message", 12000],
  ["Checking every citation", 18000],
];

export const PLAN_STEPS: [string, number][] = [
  ["Searching every conversation", 0],
  ["Gathering what each person wanted", 4000],
  ["Muse is weighing the options", 12000],
  ["Writing up the plans", 28000],
  ["Dropping citations that do not check out", 38000],
];
