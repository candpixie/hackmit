"use client";

/**
 * The archive, as a book.
 *
 * One continuous read over the same card feed the dashboard uses, so the
 * people, the unanswered questions, the plans and the memories are chapters
 * rather than three separate pages you navigate between.
 *
 * Paging is deliberately physical: arrow keys, click the outer third, or drag.
 * A book is the right metaphor because the evidence is already chronological
 * and already someone's own words, and because a spread gives a claim and its
 * proof somewhere to sit opposite each other.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Leaf } from "@/components/Leaf";
import { useArchive } from "@/lib/useArchive";
import { Loading } from "@/components/Loading";

type Ev = {
  id: string;
  sender: string;
  isFromOwner: boolean;
  isKey: boolean;
  threadName: string;
  timestamp: string;
  text: string;
};

type Card = {
  id: string;
  kind: string;
  score: number;
  rank: number | null;
  friend: { name: string; threadId: string };
  title: string;
  body: string;
  stats: { label: string; value: string }[];
  evidence: Ev[];
  action: { label: string; draft: string | null } | null;
};

type Envelope = { generatedAt: string; owner: string; cards: Card[] };

const CHAPTERS: { kind: string; label: string; roman: string }[] = [
  { kind: "your_people", label: "Your people", roman: "I" },
  { kind: "unanswered", label: "What you never answered", roman: "II" },
  { kind: "unfinished_plans", label: "What never happened", roman: "III" },
  { kind: "both_wanted", label: "What you both wanted", roman: "IV" },
  { kind: "memory_lane", label: "What it was like", roman: "V" },
  { kind: "recap", label: "The whole of it", roman: "VI" },
];

type Page =
  | { type: "cover"; env: Envelope }
  | { type: "chapter"; label: string; roman: string; count: number }
  | { type: "card"; card: Card }
  | { type: "end"; env: Envelope };

function paginate(env: Envelope): Page[] {
  const pages: Page[] = [{ type: "cover", env }];

  for (const ch of CHAPTERS) {
    const cards = env.cards
      .filter((c) => c.kind === ch.kind)
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.score - a.score);
    if (!cards.length) continue;

    pages.push({ type: "chapter", label: ch.label, roman: ch.roman, count: cards.length });
    for (const card of cards.slice(0, 5)) pages.push({ type: "card", card });
  }

  pages.push({ type: "end", env });
  return pages;
}

export default function BookPage() {
  const { archive, checked } = useArchive();
  const [env, setEnv] = useState<Envelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    if (!checked) return;

    // Read whatever archive the other surfaces are on, so the book is not
    // quietly about someone else.
    const url = archive.session
      ? `/api/cards?session=${encodeURIComponent(archive.session)}`
      : "/api/cards";

    fetch(url)
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? "Could not open the archive.");
        return b as Envelope;
      })
      .then(setEnv)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed."));
  }, [checked, archive.session]);

  const pages = useMemo(() => (env ? paginate(env) : []), [env]);

  const go = useCallback(
    (n: number) => setI((v) => Math.min(Math.max(v + n, 0), Math.max(pages.length - 1, 0))),
    [pages.length]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      }
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-[15px] text-ember">{error}</p>
      </main>
    );
  }

  if (!env) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <Loading stage="parsing" note="Opening the archive." />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div
        className="book-stack relative w-full max-w-[1180px] aspect-[3/4] sm:aspect-[4/3] lg:aspect-[16/10]"
        style={{ perspective: "2600px" }}
        onPointerDown={(e) => (drag.current = e.clientX)}
        onPointerUp={(e) => {
          if (drag.current === null) return;
          const dx = e.clientX - drag.current;
          drag.current = null;
          if (Math.abs(dx) > 60) return go(dx < 0 ? 1 : -1);
          // A click on the outer third turns, like a real page.
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          if (x > 0.66) go(1);
          else if (x < 0.2) go(-1);
        }}
      >
        {pages.map((p, n) => (
          <Leaf key={n} index={n} current={i} total={pages.length} back={<Verso n={n} />}>
            <PageBody page={p} n={n} total={pages.length} />
          </Leaf>
        ))}
      </div>


      <div className="mt-7 flex w-full max-w-[1180px] items-center justify-between">
        <button
          onClick={() => go(-1)}
          disabled={i === 0}
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-bone disabled:opacity-20"
        >
          ← Back
        </button>
        <p className="hidden font-mono text-[10px] tracking-[0.18em] text-faint sm:block">
          {i + 1} / {pages.length} · arrows, drag, or click the edge
        </p>
        <p className="font-mono text-[10px] tabular-nums tracking-[0.18em] text-faint sm:hidden">
          {i + 1} / {pages.length}
        </p>
        <button
          onClick={() => go(1)}
          disabled={i >= pages.length - 1}
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-bone disabled:opacity-20"
        >
          Turn →
        </button>
      </div>
    </main>
  );
}

/** The back of a leaf: a folio and nothing else, the way a real reverse looks mid-turn. */
function Verso({ n }: { n: number }) {
  return (
    <div className="flex h-full items-end justify-start p-12">
      <p className="font-mono text-[10px] tracking-[0.2em] text-faint">{n}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PageBody({ page, n, total }: { page: Page; n: number; total: number }) {
  return (
    <div className="relative h-full overflow-y-auto px-6 py-8 sm:pl-16 sm:pr-10 lg:pl-24 lg:pr-14 lg:py-12">
      {page.type === "cover" ? <Cover env={page.env} /> : null}
      {page.type === "chapter" ? <Chapter page={page} /> : null}
      {page.type === "card" ? <CardSpread card={page.card} /> : null}
      {page.type === "end" ? <End env={page.env} /> : null}

      {page.type !== "cover" ? (
        <p className="absolute bottom-7 right-14 font-mono text-[10px] tracking-[0.2em] text-faint">
          {String(n).padStart(2, "0")} / {String(total - 1).padStart(2, "0")}
        </p>
      ) : null}
    </div>
  );
}

/** The owner is sometimes literally called "you", which no possessive survives. */
function possessive(owner: string): string {
  const o = owner.trim();
  if (/^(you|me|i)$/i.test(o)) return "An archive of your";
  return `An archive of ${o}${o.toLowerCase().endsWith("s") ? "'" : "'s"}`;
}

function Cover({ env }: { env: Envelope }) {
  const n = env.cards.length;
  return (
    <div className="flex h-full flex-col justify-between">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-faint">
        {possessive(env.owner)} conversations
      </p>

      <div>
        <h1 className="font-serif text-[46px] leading-[0.9] tracking-tight text-bone sm:text-[64px] lg:text-[86px] lg:leading-[0.86]">
          Insta
          <br />
          Insights
        </h1>
        <p className="mt-9 max-w-lg text-[19px] leading-relaxed text-bone">
          The friendships you're about to lose, and the one message that gets them
          back.
        </p>
      </div>

      <div className="flex items-end justify-between">
        <p className="max-w-sm text-[13px] leading-relaxed text-faint">
          {n} things found in your own messages. Every one of them can be traced back
          to the message it came from.
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ember">
          Turn the page →
        </p>
      </div>
    </div>
  );
}

function Chapter({ page }: { page: Extract<Page, { type: "chapter" }> }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="font-serif text-[22px] text-ember">{page.roman}</p>
      <h2 className="mt-5 max-w-2xl font-serif text-[40px] leading-[1] tracking-tight text-bone sm:text-[52px] lg:text-[68px] lg:leading-[0.95]">
        {page.label}
      </h2>
      <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
        {page.count} {page.count === 1 ? "entry" : "entries"}
      </p>
    </div>
  );
}

function CardSpread({ card }: { card: Card }) {
  const [draft, setDraft] = useState(card.action?.draft ?? "");
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid h-full gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-14">
      {/* recto: the claim */}
      <div className="flex flex-col justify-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">
          {card.friend.name}
          {card.rank ? ` · no. ${card.rank}` : ""}
        </p>

        <h2 className="mt-5 font-serif text-[28px] leading-[1.06] tracking-tight text-bone sm:text-[34px] lg:text-[40px] lg:leading-[1.02]">
          {card.title}
        </h2>

        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
          {card.body}
        </p>

        {card.stats.length ? (
          <dl className="mt-9 grid max-w-sm grid-cols-2 gap-x-8 gap-y-5">
            {card.stats.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
                  {s.label}
                </dt>
                <dd className="mt-1 text-[17px] tabular-nums text-bone">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {card.action?.draft ? (
          <div className="mt-9 max-w-md">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-line bg-card px-4 py-3 font-serif text-[16px] leading-relaxed text-bone"
            />
            <button
              onClick={() => {
                void navigator.clipboard.writeText(draft);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              className="mt-3 rounded-md bg-ember px-5 py-2 text-[13px] font-medium text-ink transition-opacity hover:opacity-90"
            >
              {copied ? "Copied" : card.action.label}
            </button>
          </div>
        ) : null}
      </div>

      {/* verso: the proof */}
      <div className="flex flex-col justify-center lg:overflow-hidden">
        {card.evidence.length ? (
          <>
            <p className="mb-5 font-mono text-[9px] uppercase tracking-[0.22em] text-faint">
              From your messages
            </p>
            <ul className="space-y-2.5">
              {card.evidence.slice(0, 5).map((e, idx, all) => {
                const prev = all[idx - 1];
                const jump =
                  prev &&
                  new Date(e.timestamp).getTime() - new Date(prev.timestamp).getTime() >
                    3 * 86_400_000;

                return (
                  <li key={e.id}>
                    {jump ? (
                      <p className="py-3 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                        {new Date(e.timestamp).toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    ) : null}

                    <div
                      className={`flex ${e.isFromOwner ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[86%] rounded-2xl px-5 py-3 ${
                          e.isKey
                            ? "border border-ember/45 bg-ember/[0.07]"
                            : "border border-line bg-card"
                        }`}
                      >
                        <p
                          className={`font-serif text-[16px] leading-snug ${
                            e.isKey ? "text-bone" : "text-muted"
                          }`}
                        >
                          {e.text}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 font-mono text-[9px] tracking-[0.16em] text-faint">
              {card.evidence[0].threadName} ·{" "}
              {new Date(card.evidence[0].timestamp).toLocaleDateString()}
            </p>
          </>
        ) : (
          <p className="text-[14px] leading-relaxed text-faint">
            No single message carries this one. It is the shape of the whole
            conversation.
          </p>
        )}
      </div>
    </div>
  );
}

function End({ env }: { env: Envelope }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-faint">
        The end of the archive
      </p>
      <h2 className="mt-8 max-w-2xl font-serif text-[36px] leading-[1.02] tracking-tight text-bone sm:text-[46px] lg:text-[56px] lg:leading-[0.98]">
        None of them need a paragraph.
      </h2>
      <p className="mt-7 max-w-lg text-[16px] leading-relaxed text-muted">
        They need you to answer the thing you never answered.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <a
          href="/"
          className="rounded-md bg-ember px-6 py-3 text-[14px] font-medium text-ink"
        >
          Write the message
        </a>
        <a
          href="/insights"
          className="rounded-md border border-line px-6 py-3 text-[14px] text-muted transition-colors hover:border-faint hover:text-bone"
        >
          See it as a list
        </a>
        <a
          href="/wrapped"
          className="rounded-md border border-line px-6 py-3 text-[14px] text-muted transition-colors hover:border-faint hover:text-bone"
        >
          Your year in DMs
        </a>
      </div>

      <p className="mt-10 font-mono text-[10px] leading-relaxed text-faint">
        Read on this machine. Nothing left it.
      </p>
    </div>
  );
}
