"use client";

/**
 * Insta Insights Wrapped.
 *
 * Six slides, arrow keys or click. The third one asks you to guess before it
 * tells you, which is the only moment in the whole product where the person
 * has to commit to an answer, and it is the one that makes the reveal land.
 *
 * Everything on screen is counted from the archive. There are no percentiles
 * against users we do not have and no scores on scales we invented.
 */

import { useCallback, useEffect, useState } from "react";
import { useArchive } from "@/lib/useArchive";

type Evidence = { kind: string; quote: string; reason: string; messageId: string };
type Tie = { thread: string; friend: string; silenceDays: number; totalMessages: number };

type Wrapped = {
  session: string;
  owner: string;
  counts: { unanswered: number; neverHappened: number; theyWanted: number; dormant: number };
  stats: {
    totals: { conversations: number; messages: number; sent: number; received: number };
    loudestHour: { label: string; count: number } | null;
    timezoneShiftHours: number;
    byMonth: { month: string; label: string; count: number }[];
    peakMonth: { label: string; count: number } | null;
    longestStreak: { days: number; thread: string } | null;
    replySpeed: {
      fastest: { thread: string; medianMinutes: number } | null;
      slowest: { thread: string; medianMinutes: number } | null;
    };
    repeatedPlans: {
      friend: string;
      quote: string;
      times: number;
      daysSince: number;
    }[];
  };
  guess: {
    answerThread: string;
    options: Tie[];
    reveal: {
      friend: string;
      headline: string;
      silenceDays: number;
      totalMessages: number;
      evidence: Evidence[];
    };
  } | null;
  wants: { friend: string; quote: string; id: string }[];
};

const SLIDES = 6;

export default function WrappedPage() {
  const { archive, checked } = useArchive();
  const [data, setData] = useState<Wrapped | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dir, setDir] = useState("~/Downloads/inbox");
  const [busy, setBusy] = useState(false);
  const [slide, setSlide] = useState(0);

  // Another surface already parsed this archive; re-reading it costs half a
  // minute for nothing.
  useEffect(() => {
    if (!checked || !archive.session || data) return;
    fetch(`/api/wrapped?session=${encodeURIComponent(archive.session)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d as Wrapped))
      .catch(() => {});
  }, [checked, archive.session, data]);

  const go = useCallback((n: number) => {
    setSlide((s) => Math.min(Math.max(s + n, 0), SLIDES - 1));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wrapped", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ localDir: dir }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not read that archive.");
      setData(body as Wrapped);
      setSlide(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-faint">
            Insta Insights
          </p>
          <h1 className="mt-5 font-serif text-6xl leading-[0.95] tracking-tight text-bone">
            Your year
            <br />
            in DMs.
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed text-muted">
            Point it at your Instagram export. Everything is counted from the archive
            and nothing leaves this machine.
          </p>

          <div className="mt-8 flex gap-3">
            <input
              value={dir}
              onChange={(e) => setDir(e.target.value)}
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-line bg-card px-4 py-3 font-mono text-[13px] text-bone"
            />
            <button
              onClick={load}
              disabled={busy}
              className="rounded-md bg-ember px-6 py-3 text-[14px] font-medium text-ink disabled:opacity-50"
            >
              {busy ? "Reading…" : "Start"}
            </button>
          </div>
          {error ? <p className="mt-4 text-[13px] text-ember">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col">
      {/* progress */}
      <div className="flex gap-1.5 px-10 pt-8">
        {Array.from({ length: SLIDES }).map((_, i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            className={`h-[2px] flex-1 rounded-full transition-colors ${
              i <= slide ? "bg-bone" : "bg-line"
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      <div className="flex items-baseline justify-between px-10 pt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-faint">
          Insta Insights · Wrapped
        </p>
        <p className="font-mono text-[11px] tabular-nums text-faint">
          {String(slide + 1).padStart(2, "0")} / {String(SLIDES).padStart(2, "0")}
        </p>
      </div>

      <div key={slide} className="rise flex flex-1 items-center px-10 py-10">
        {slide === 0 ? <Cover d={data} /> : null}
        {slide === 1 ? <RawCount d={data} /> : null}
        {slide === 2 ? <Guess d={data} /> : null}
        {slide === 3 ? <Plans d={data} /> : null}
        {slide === 4 ? <Wants d={data} /> : null}
        {slide === 5 ? <Ending d={data} /> : null}
      </div>

      <div className="flex items-center justify-between px-10 pb-8">
        <button
          onClick={() => go(-1)}
          disabled={slide === 0}
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-bone disabled:opacity-25"
        >
          ← Back
        </button>
        <p className="font-mono text-[10px] text-faint">Arrow keys</p>
        <button
          onClick={() => go(1)}
          disabled={slide === SLIDES - 1}
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-bone disabled:opacity-25"
        >
          Next →
        </button>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember">
      {children}
    </p>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <p className="font-serif text-[44px] leading-none tabular-nums text-bone">{n}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        {label}
      </p>
    </div>
  );
}

function Cover({ d }: { d: Wrapped }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-16 lg:grid-cols-2 lg:items-center">
      <div>
        <Kicker>Your year in DMs</Kicker>
        <h1 className="mt-6 font-serif text-[76px] leading-[0.88] tracking-tight text-bone">
          Insta
          <br />
          Insights
        </h1>
        <p className="mt-8 max-w-md text-[19px] leading-relaxed text-bone">
          The friendships you're about to lose, and the one message that gets them
          back.
        </p>
        <p className="mt-4 max-w-md text-[14px] leading-relaxed text-muted">
          Nobody loses friends in a fight. They lose them to a year of being busy.
        </p>
      </div>

      <div className="space-y-3">
        <Finding n={d.counts.unanswered} label="Unanswered" sub="questions they asked that you never came back to" />
        <Finding n={d.counts.neverHappened} label="Never happened" sub="plans said out loud, agreed to, never booked" />
        <Finding n={d.counts.theyWanted} label="They wanted" sub="things mentioned in passing, across your chats" />

        <p className="pt-6 text-[13px] leading-relaxed text-faint">
          Read from {d.stats.totals.conversations.toLocaleString()} conversations and{" "}
          {d.stats.totals.messages.toLocaleString()} messages on this machine. Nothing
          left it.
        </p>
      </div>
    </div>
  );
}

function Finding({ n, label, sub }: { n: number; label: string; sub: string }) {
  return (
    <div className="flex items-baseline gap-6 border-b border-line py-5">
      <p className="w-20 shrink-0 font-serif text-[40px] leading-none tabular-nums text-ember">
        {n}
      </p>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone">
          {label}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{sub}</p>
      </div>
    </div>
  );
}

function RawCount({ d }: { d: Wrapped }) {
  const max = Math.max(...d.stats.byMonth.map((m) => m.count), 1);
  const s = d.stats;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-16 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-center">
      <div>
        <Kicker>The raw count</Kicker>
        <h2 className="mt-6 font-serif text-[56px] leading-[0.95] tracking-tight text-bone">
          You typed
          <br />
          a novel.
        </h2>
        <p className="mt-6 text-[14px] leading-relaxed text-muted">
          {s.totals.sent.toLocaleString()} sent, {s.totals.received.toLocaleString()}{" "}
          received, across {s.totals.conversations} conversations.
        </p>
        {s.timezoneShiftHours !== 0 ? (
          <p className="mt-5 border-l-2 border-line pl-4 text-[13px] leading-relaxed text-faint">
            Your export was written {Math.abs(s.timezoneShiftHours)} hours off from
            where these were actually sent. We worked that out from the hours you
            sleep, and corrected it.
          </p>
        ) : null}
      </div>

      <div>
        <div className="rounded-lg border border-line bg-card p-7">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              Messages by month
            </p>
            {s.peakMonth ? (
              <p className="font-mono text-[10px] text-faint">
                peak {s.peakMonth.label} · {s.peakMonth.count.toLocaleString()}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex h-36 items-end gap-[3px]">
            {s.byMonth.map((m) => (
              <div key={m.month} className="flex-1" title={`${m.month}: ${m.count}`}>
                <div
                  className={`rounded-sm ${
                    m.count === max ? "bg-ember" : "bg-ember/25"
                  }`}
                  style={{ height: `${Math.max((m.count / max) * 140, 2)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-[3px]">
            {s.byMonth.map((m, i) => (
              <p
                key={m.month}
                className="flex-1 text-center font-mono text-[9px] text-faint"
              >
                {i % 2 === 0 ? m.label : ""}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          {s.loudestHour ? (
            <Stat n={s.loudestHour.label} label="your loudest hour" />
          ) : null}
          {s.longestStreak ? (
            <Stat n={`${s.longestStreak.days}d`} label={`longest streak · ${s.longestStreak.thread}`} />
          ) : null}
          {s.replySpeed.fastest ? (
            <Stat
              n={`${s.replySpeed.fastest.medianMinutes}m`}
              label={`fastest reply · ${s.replySpeed.fastest.thread}`}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The one moment that asks the person to commit before it tells them. */
function Guess({ d }: { d: Wrapped }) {
  const [picked, setPicked] = useState<string | null>(null);
  const g = d.guess;

  if (!g) return <p className="text-muted">Not enough history to ask.</p>;

  const right = picked === g.answerThread;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Kicker>Signal 01 — Unanswered</Kicker>

      {!picked ? (
        <>
          <h2 className="mt-6 font-serif text-[56px] leading-[0.95] tracking-tight text-bone">
            Who have you
            <br />
            ignored the most?
          </h2>
          <p className="mt-5 text-[15px] text-muted">
            Pick one. Then we'll show you what they asked.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {g.options.map((o) => (
              <button
                key={o.thread}
                onClick={() => setPicked(o.thread)}
                className="rounded-lg border border-line bg-card px-5 py-6 text-left transition-colors hover:border-ember"
              >
                <p className="truncate text-[17px] text-bone">{o.friend}</p>
                <p className="mt-2 font-mono text-[11px] text-faint">
                  {o.totalMessages.toLocaleString()} messages
                </p>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="rise">
          <h2 className="mt-6 font-serif text-[52px] leading-[0.95] tracking-tight text-bone">
            {right ? "You knew." : "It was " + g.reveal.friend + "."}
          </h2>
          <p className="mt-4 text-[15px] text-muted">
            {right
              ? `${g.reveal.friend}. ${g.reveal.headline}`
              : `You picked someone else. ${g.reveal.headline}`}
          </p>

          <ul className="mt-9 space-y-3">
            {g.reveal.evidence.map((e) => (
              <li key={e.messageId} className="rounded-lg border border-ember/40 bg-ember/[0.06] px-6 py-5">
                <blockquote className="border-l-2 border-ember/50 pl-4 font-serif text-[21px] leading-snug text-bone">
                  {e.quote}
                </blockquote>
                <p className="mt-3 text-[13px] text-muted">{e.reason}</p>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setPicked(null)}
            className="mt-7 font-mono text-[11px] uppercase tracking-[0.2em] text-faint hover:text-bone"
          >
            Guess again
          </button>
        </div>
      )}
    </div>
  );
}

function Plans({ d }: { d: Wrapped }) {
  const plans = d.stats.repeatedPlans;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-16 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-center">
      <div>
        <Kicker>Signal 02 — Never happened</Kicker>
        <h2 className="mt-6 font-serif text-[56px] leading-[0.95] tracking-tight text-bone">
          You made {d.counts.neverHappened} plans.
        </h2>
        <p className="mt-6 text-[15px] leading-relaxed text-muted">
          Said out loud, agreed to enthusiastically, then never mentioned again by
          either of you.
        </p>
        {plans[0] ? (
          <p className="mt-7 rounded-lg border border-line bg-card px-6 py-5 text-[15px] leading-relaxed text-bone">
            {plans[0].friend} brought this up{" "}
            <span className="text-ember">{plans[0].times} times</span>. The last was{" "}
            {plans[0].daysSince} days ago, and nobody has raised it since.
          </p>
        ) : null}
      </div>

      <ul className="space-y-3">
        {plans.map((p) => (
          <li
            key={p.quote}
            className="flex items-baseline gap-5 rounded-lg border border-line bg-card px-6 py-5"
          >
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[18px] leading-snug text-bone">
                “{p.quote}”
              </p>
              <p className="mt-2 font-mono text-[11px] text-faint">
                {p.friend} · last {p.daysSince}d ago
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-ember/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ember">
              {p.times}×
            </span>
          </li>
        ))}
        {!plans.length ? (
          <li className="text-[14px] text-muted">
            No plan was raised more than once in this archive.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function Wants({ d }: { d: Wrapped }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-16 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-center">
      <div>
        <Kicker>Signal 03 — They wanted</Kicker>
        <h2 className="mt-6 font-serif text-[56px] leading-[0.95] tracking-tight text-bone">
          Things they
          <br />
          told you,
          <br />
          in passing.
        </h2>
        <p className="mt-6 text-[15px] leading-relaxed text-muted">
          Said once, never followed up on, scattered across different chats months
          apart.
        </p>
        <p className="mt-7 border-l-2 border-line pl-4 text-[13px] leading-relaxed text-faint">
          This is the query a per-thread scroll cannot answer: who has ever mentioned
          wanting this. It spans people, so it runs in Elasticsearch.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {d.wants.map((w) => (
          <div key={w.id} className="rounded-lg border border-line bg-card px-6 py-5">
            <p className="font-mono text-[11px] text-faint">{w.friend}</p>
            <p className="mt-3 font-serif text-[18px] leading-snug text-bone">
              “{w.quote}”
            </p>
          </div>
        ))}
        {!d.wants.length ? (
          <p className="text-[14px] text-muted">Nothing specific was wished for here.</p>
        ) : null}
      </div>
    </div>
  );
}

function Ending({ d }: { d: Wrapped }) {
  return (
    <div className="mx-auto w-full max-w-3xl text-center">
      <Kicker>One message</Kicker>
      <h2 className="mt-7 font-serif text-[64px] leading-[0.95] tracking-tight text-bone">
        {d.counts.dormant} friendships
        <br />
        are going quiet.
      </h2>
      <p className="mx-auto mt-8 max-w-xl text-[17px] leading-relaxed text-muted">
        None of them need a paragraph. They need you to answer the thing you never
        answered.
      </p>

      <a
        href="/"
        className="mt-10 inline-block rounded-md bg-ember px-7 py-3.5 text-[15px] font-medium text-ink transition-opacity hover:opacity-90"
      >
        Write the message
      </a>

      <p className="mt-8 font-mono text-[11px] leading-relaxed text-faint">
        Every number here was counted from your archive. No percentiles, no scores we
        invented a scale for.
      </p>
    </div>
  );
}
