"use client";

import { museHeaders } from "./MuseKey";
import { useEffect, useMemo, useState } from "react";
import { KIND_LABEL, type Evidence, type TieView } from "@/lib/types";
import { Recap } from "./Recap";
import { Working, DRAFT_STEPS } from "./Working";

type Draft = {
  message: string;
  /** Message ids the draft leaned on, in the order it used them. */
  cites: string[];
  model: string;
};

function when(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Detail({
  tie,
  owner,
  session,
}: {
  tie: TieView;
  owner: string;
  session: string;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tab, setTab] = useState<"unfinished" | "recap">("unfinished");

  // A new friend means a new draft.
  useEffect(() => {
    setDraft(null);
    setFailed(null);
    setTab("unfinished");
  }, [tie.thread]);

  const used = useMemo(() => new Set(draft?.cites ?? []), [draft]);

  async function write() {
    setBusy(true);
    setFailed(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "content-type": "application/json", ...museHeaders() },
        body: JSON.stringify({ tie, owner }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Draft failed.");
      setDraft(data as Draft);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Draft failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section key={tie.thread} className="rise min-w-0">
      <header className="border-b border-line pb-7">
        <h2 className="font-serif text-4xl leading-tight text-bone">{tie.friend}</h2>
        <p className="mt-3 text-[15px] text-muted">{tie.headline}</p>

        <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
          <Stat label="Peak" value={`${Math.round(tie.peakPerWeek)}/wk`} />
          <Stat label="Now" value={`${tie.currentPerWeek}/wk`} />
          <Stat label="Messages" value={tie.totalMessages.toLocaleString()} />
          <Stat
            label="You sent"
            value={`${Math.round(tie.yourShare * 100)}%`}
            note={
              tie.yourShare < 0.38
                ? "They carried it"
                : tie.yourShare > 0.62
                  ? "You carried it"
                  : undefined
            }
          />
        </dl>
      </header>

      <div className="pt-8">
        <div className="flex gap-6 border-b border-line">
          {(
            [
              ["unfinished", "What was left unfinished"],
              ["recap", "What it was like"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b pb-3 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                tab === key
                  ? "border-ember text-bone"
                  : "border-transparent text-faint hover:text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "recap" ? (
        <Recap session={session} thread={tie.thread} />
      ) : (
      <div className="pb-8">
        {tie.evidence.length === 0 ? (
          <p className="mt-5 text-[13px] text-muted">
            Nothing specific was left hanging here. The silence is the whole signal.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {tie.evidence.slice(0, 5).map((e) => (
              <EvidenceCard
                key={e.messageId}
                evidence={e}
                cited={used.has(e.messageId)}
                lit={hovered === e.messageId}
                onHover={setHovered}
              />
            ))}
          </ul>
        )}
      </div>
      )}

      {tab === "unfinished" ? (
      <div className="border-t border-line pt-8">
        {!draft ? (
          <>
            {busy ? (
              <Working
                steps={DRAFT_STEPS}
                note="Muse Spark reasons before it writes, so this takes about twenty seconds."
              />
            ) : (
              <>
                <button
                  onClick={write}
                  className="rounded-md bg-ember px-5 py-2.5 text-[13px] font-medium text-ink transition-opacity hover:opacity-90"
                >
                  {`Write to ${tie.friend.split(" ")[0]}`}
                </button>
                <p className="mt-3 text-[13px] text-faint">
                  Grounded in the messages above. Every claim stays clickable.
                </p>
              </>
            )}
            {failed ? <p className="mt-3 text-[13px] text-ember">{failed}</p> : null}
          </>
        ) : (
          <div className="rise">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
                Draft
              </h3>
              <span className="font-mono text-[11px] text-faint">{draft.model}</span>
            </div>

            <p className="mt-5 whitespace-pre-wrap font-serif text-[21px] leading-[1.6] text-bone">
              {draft.message}
            </p>

            <p className="mt-6 text-[13px] leading-relaxed text-faint">
              Built from{" "}
              {draft.cites.length === 0
                ? "the silence alone"
                : `${draft.cites.length} ${
                    draft.cites.length === 1 ? "message" : "messages"
                  } above, now highlighted`}
              .
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => void navigator.clipboard.writeText(draft.message)}
                className="rounded-md bg-bone px-5 py-2.5 text-[13px] font-medium text-ink transition-opacity hover:opacity-90"
              >
                Copy
              </button>
              <button
                onClick={write}
                disabled={busy}
                className="rounded-md border border-line px-5 py-2.5 text-[13px] text-muted transition-colors hover:border-faint hover:text-bone disabled:opacity-60"
              >
                {busy ? "Writing…" : "Try again"}
              </button>
            </div>
          </div>
        )}
      </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
        {label}
      </dt>
      <dd className="mt-1.5 text-[17px] tabular-nums text-bone">{value}</dd>
      {note ? <p className="mt-1 text-[11px] text-ember">{note}</p> : null}
    </div>
  );
}

function EvidenceCard({
  evidence,
  cited,
  lit,
  onHover,
}: {
  evidence: Evidence;
  cited: boolean;
  lit: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <li
      onMouseEnter={() => onHover(evidence.messageId)}
      onMouseLeave={() => onHover(null)}
      className={`rounded-lg border px-5 py-4 transition-colors ${
        cited || lit ? "border-ember/45 bg-ember/[0.06]" : "border-line bg-card"
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
            cited ? "text-ember" : "text-faint"
          }`}
        >
          {KIND_LABEL[evidence.kind]}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-faint">
          {when(evidence.ts)}
        </span>
      </div>

      <blockquote className="mt-3 border-l-2 border-line pl-4 font-serif text-[17px] leading-snug text-bone">
        {evidence.quote}
      </blockquote>

      <p className="mt-3 text-[13px] leading-relaxed text-muted">{evidence.reason}</p>
    </li>
  );
}
