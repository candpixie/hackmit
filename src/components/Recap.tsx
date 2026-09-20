"use client";

import { museHeaders } from "./MuseKey";
import { useEffect, useState } from "react";

type Moment = {
  kind: "laughter" | "late-night" | "burst" | "depth" | "first" | "last";
  ts: number;
  label: string;
  caption?: string | null;
  messages: { id: string; sender: string; text: string }[];
};

type RecapData = {
  moments: Moment[];
  bookends?: { first: Moment; last: Moment } | null;
  closing?: string | null;
  note?: string;
  model?: string;
};

const KIND: Record<Moment["kind"], string> = {
  laughter: "Laughing",
  "late-night": "Late night",
  burst: "All at once",
  depth: "Said properly",
  first: "How it started",
  last: "How it stopped",
};

function when(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function Recap({ session, thread }: { session: string; thread: string }) {
  const [data, setData] = useState<RecapData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setBusy(true);
    setData(null);
    setError(null);

    fetch("/api/recap", {
      method: "POST",
      headers: { "content-type": "application/json", ...museHeaders() },
      body: JSON.stringify({ session, thread }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not build a recap.");
        return body as RecapData;
      })
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Failed."))
      .finally(() => live && setBusy(false));

    return () => {
      live = false;
    };
  }, [session, thread]);

  if (busy) {
    return <p className="py-8 text-[13px] text-faint">Reading back through it…</p>;
  }

  if (error) {
    return <p className="py-8 text-[13px] text-ember">{error}</p>;
  }

  if (!data?.moments.length) {
    return (
      <p className="py-8 text-[13px] text-muted">
        {data?.note ?? "Not enough back and forth here to build a recap."}
      </p>
    );
  }

  const first = data.bookends?.first;

  return (
    <div className="rise py-8">
      {first ? (
        <div className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            {KIND.first} · {when(first.ts)}
          </p>
          <p className="mt-3 font-serif text-[17px] leading-snug text-muted">
            {first.messages[0]?.sender}: “{first.messages[0]?.text}”
          </p>
        </div>
      ) : null}

      {/* The timeline. A rule down the left so it reads as one run of time. */}
      <ol className="space-y-8 border-l border-line pl-7">
        {data.moments.map((m) => (
          <li key={`${m.ts}-${m.kind}`} className="relative">
            <span className="absolute -left-[33px] top-[7px] h-[7px] w-[7px] rounded-full bg-ember" />

            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
              {KIND[m.kind]} · {when(m.ts)}
            </p>

            {m.caption ? (
              <p className="mt-2 font-serif text-[21px] leading-snug text-bone">
                {m.caption}
              </p>
            ) : (
              <p className="mt-2 font-serif text-[21px] leading-snug text-bone">
                {m.label}
              </p>
            )}

            <div className="mt-3 space-y-1">
              {m.messages.slice(0, 4).map((x) => (
                <p key={x.id} className="text-[13px] leading-relaxed text-muted">
                  <span className="text-faint">{x.sender}:</span> {x.text}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {data.closing ? (
        <p className="mt-10 border-t border-line pt-7 font-serif text-[21px] leading-snug text-bone">
          {data.closing}
        </p>
      ) : null}

      {data.model && data.model !== "no narration" ? (
        <p className="mt-5 font-mono text-[11px] text-faint">
          Moments found in the messages. Captions by {data.model}.
        </p>
      ) : (
        <p className="mt-5 font-mono text-[11px] text-faint">
          Moments found in the messages. No model configured, so no captions.
        </p>
      )}
    </div>
  );
}
