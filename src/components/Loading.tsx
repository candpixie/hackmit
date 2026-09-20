"use client";

/**
 * What a long wait should look like.
 *
 * A thirty second parse with nothing on screen reads as a frozen app, so this
 * names the stage that is actually running and shows a shimmer rather than a
 * percentage nobody can verify. The stage labels come from the real sequence
 * of work, not a timer pretending to be progress.
 */

import { STAGE_LABEL, type Stage } from "@/lib/useArchive";

const ORDER: Stage[] = ["reading", "parsing", "scoring", "indexing"];

export function Loading({ stage, note }: { stage: Stage; note?: string }) {
  const at = ORDER.indexOf(stage);

  return (
    <div className="w-full max-w-md" role="status" aria-live="polite">
      <ol className="space-y-2.5">
        {ORDER.map((s, i) => {
          const done = at > i;
          const now = at === i;

          return (
            <li key={s} className="flex items-center gap-3">
              <span
                className={`h-[5px] w-[5px] shrink-0 rounded-full transition-colors ${
                  done ? "bg-sage" : now ? "bg-ember" : "bg-line"
                }`}
              />
              <span
                className={`font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                  now ? "text-bone" : done ? "text-faint" : "text-line"
                }`}
              >
                {STAGE_LABEL[s]}
              </span>
              {now ? (
                <span className="ml-1 flex gap-[3px]" aria-hidden>
                  <Dot delay={0} />
                  <Dot delay={160} />
                  <Dot delay={320} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 h-[2px] w-full overflow-hidden rounded-full bg-line">
        <div className="h-full w-1/3 rounded-full bg-ember/70 [animation:slide_1.4s_ease-in-out_infinite]" />
      </div>

      {note ? <p className="mt-4 text-[13px] leading-relaxed text-faint">{note}</p> : null}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="h-[3px] w-[3px] rounded-full bg-ember [animation:blink_1.2s_ease-in-out_infinite]"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

/** Reserves the space content will occupy, so nothing jumps when it arrives. */
export function Skeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-[13px] rounded bg-line/70 [animation:shimmer_1.8s_ease-in-out_infinite]"
          style={{
            width: `${[92, 78, 85, 64, 71][i % 5]}%`,
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}
