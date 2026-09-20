/**
 * Turns the engine's output into the display contract in CARDS_CONTRACT.md.
 *
 * The frontend renders cards and computes nothing, so every sentence a person
 * reads is written here. The rules that matter, from the contract:
 *
 *   - every key is always present; empty is null or [], never missing
 *   - ids are stable across runs, so "dismissed" state survives a re-analysis
 *   - stats values are display strings, not numbers
 *   - evidence is oldest first, with isKey marking the message the card is about
 */

import { createHash } from "node:crypto";
import type { Message, Thread } from "./parse.ts";
import { analyse, type Tie } from "./signals.ts";
import { closeness, closenessHeadline } from "./closeness.ts";
import { highlights } from "./recap.ts";
import { wrappedStats } from "./wrapped.ts";

const DAY = 86_400_000;

export type CardEvidence = {
  id: string;
  sender: string;
  isFromOwner: boolean;
  isKey: boolean;
  threadName: string;
  timestamp: string;
  text: string;
};

export type Card = {
  id: string;
  kind: string;
  score: number;
  rank: number | null;
  friend: { name: string; threadId: string };
  title: string;
  body: string;
  stats: { label: string; value: string }[];
  evidence: CardEvidence[];
  action: { label: string; draft: string | null } | null;
};

export type CardsEnvelope = {
  generatedAt: string;
  owner: string;
  cards: Card[];
};

/* ------------------------------------------------------------------ */

/** Stable across runs: the same insight always gets the same id. */
function id(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 8);
}

const iso = (ts: number) => new Date(ts).toISOString();

function monthYear(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function ago(days: number): string {
  if (days < 45) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = days / 365;
  return years < 1.2 ? "about a year ago" : `${years.toFixed(1)} years ago`;
}

function ev(
  m: Message,
  owner: string,
  threadName: string,
  isKey: boolean
): CardEvidence {
  return {
    id: m.id,
    sender: m.sender,
    isFromOwner: m.sender === owner,
    isKey,
    threadName,
    timestamp: iso(m.ts),
    text: m.text,
  };
}

/** The messages around one, so a quote has context. */
function surround(messages: Message[], index: number, before = 1, after = 3): Message[] {
  return messages.slice(Math.max(0, index - before), Math.min(messages.length, index + after));
}

function firstName(name: string): string {
  return name.split(/\s+/)[0];
}

/* ------------------------------------------------------------------ */

function yourPeople(threads: Thread[], owner: string, now: number): Card[] {
  const ranked = closeness(threads, owner, now).slice(0, 6);

  return ranked.map((c, i) => {
    const thread = threads.find((t) => t.name === c.thread)!;
    const messages = [...thread.messages].sort((a, b) => a.ts - b.ts);
    const stats = wrappedStats([thread], owner, now);

    const hours = stats.loudestHour ? stats.loudestHour.label : null;

    return {
      id: id("your_people", c.thread),
      kind: "your_people",
      score: Math.round(c.score * 100) / 100,
      rank: i + 1,
      friend: { name: c.friend, threadId: c.thread },
      title: c.friend,
      body: `${closenessHeadline(c)[0].toUpperCase()}${closenessHeadline(c).slice(1)}`,
      stats: [
        { label: "Messages", value: c.totalMessages.toLocaleString() },
        { label: "Talking since", value: shortDate(messages[0].ts) },
        stats.peakMonth
          ? { label: "Most active month", value: stats.peakMonth.label }
          : null,
        hours ? { label: "Usual hour", value: hours } : null,
      ].filter(Boolean) as { label: string; value: string }[],
      evidence: [],
      action: null,
    };
  });
}

/** One per friendship, best first. A feed of a hundred is not a feed. */
function unanswered(ties: Tie[], threads: Thread[], owner: string, limit = 12): Card[] {
  const cards: Card[] = [];

  for (const tie of ties) {
    const loop = tie.evidence.find((e) => e.kind === "open-loop");
    if (!loop) continue;

    const thread = threads.find((t) => t.name === tie.thread);
    if (!thread) continue;

    const messages = [...thread.messages].sort((a, b) => a.ts - b.ts);
    const at = messages.findIndex((m) => m.id === loop.messageId);
    if (at < 0) continue;

    // The question, then what was said instead.
    const evidence = surround(messages, at, 0, 4).map((m, i) =>
      ev(m, owner, thread.name, i === 0)
    );

    cards.push({
      id: id("unanswered", loop.messageId),
      kind: "unanswered",
      score: Math.round(Math.min(loop.confidence, 1) * 100) / 100,
      rank: null,
      friend: { name: tie.friend, threadId: tie.thread },
      title: `${firstName(tie.friend)} asked. You never answered.`,
      body: loop.reason,
      stats: [{ label: "Asked", value: monthYear(loop.ts) }],
      evidence,
      action: {
        label: "Respond",
        // Never quote their question back at them. Name the gap, then ask.
        draft: `ok this is ${
          Math.round(
            (Date.now() - loop.ts) / 86_400_000 / 30
          )
        } months late but i never actually answered you about this. what happened with it in the end?`,
      },
    });
  }

  return cards.sort((a, b) => b.score - a.score).slice(0, limit);
}

function unfinishedPlans(threads: Thread[], owner: string, now: number): Card[] {
  const stats = wrappedStats(threads, owner, now);

  return stats.repeatedPlans.map((p) => {
    const thread = threads.find((t) => t.name === p.thread);
    const messages = thread ? [...thread.messages].sort((a, b) => a.ts - b.ts) : [];

    // Every time it came up, all of them the point of the card.
    const mentions = messages
      .filter((m) => m.text.slice(0, 180) === p.quote || m.id === p.messageId)
      .slice(0, 4)
      .map((m) => ev(m, owner, p.thread, true));

    return {
      id: id("unfinished_plans", p.messageId),
      kind: "unfinished_plans",
      score: Math.round(Math.min(0.5 + p.times * 0.1, 0.98) * 100) / 100,
      rank: null,
      friend: { name: p.friend, threadId: p.thread },
      title: `You said this ${p.times} times. It never happened.`,
      body: `Raised ${p.times} separate times, most recently ${ago(
        p.daysSince
      )}. Nobody has brought it up since.`,
      stats: [
        { label: "Times mentioned", value: `${p.times}` },
        { label: "Last mentioned", value: ago(p.daysSince) },
      ],
      evidence: mentions.length ? mentions : [],
      action: {
        label: "Make It Happen",
        draft: `ok we have genuinely said this ${p.times} times now 😭 are you free in the next couple of weeks? i'll book it.`,
      },
    };
  });
}

function memoryLane(threads: Thread[], owner: string, ties: Tie[]): Card[] {
  const cards: Card[] = [];
  const wanted = new Set(ties.slice(0, 8).map((t) => t.thread));

  for (const thread of threads) {
    if (!wanted.has(thread.name)) continue;

    const moments = highlights(thread.messages, 2);
    const moment = moments.find((m) => m.kind === "laughter" || m.kind === "late-night");
    if (!moment) continue;

    const messages = [...thread.messages].sort((a, b) => a.ts - b.ts);
    const ids = new Set(moment.messages.map((m) => m.id));

    const evidence = messages
      .filter((m) => ids.has(m.id))
      .map((m) => ev(m, owner, thread.name, true));
    if (evidence.length < 3) continue;

    const friend = thread.participants.find((p) => p !== owner) ?? thread.name;

    cards.push({
      id: id("memory_lane", moment.messages[0].id),
      kind: "memory_lane",
      score: 0.7,
      rank: null,
      friend: { name: friend, threadId: thread.name },
      title:
        moment.kind === "late-night"
          ? `That night you were both still up`
          : `The time neither of you could stop`,
      body: `${moment.label}, ${monthYear(moment.ts)}.`,
      stats: [{ label: "When", value: monthYear(moment.ts) }],
      evidence,
      action: {
        label: "Send this memory",
        draft: `i was going through old messages and found this 😭 i forgot this even happened`,
      },
    });
  }

  return cards.slice(0, 4);
}

/**
 * Something both people independently said they wanted, possibly in different
 * chats. This is the card that needs the whole archive at once: neither person
 * ever said it to the other.
 */
function bothWanted(threads: Thread[], owner: string): Card[] {
  const WANT =
    /\b(i'?ve always wanted|i'?ve been wanting|i really want|dying to|i wish i could|i want to try|i'?d love to)\b/i;

  type Wish = { m: Message; thread: string; subject: string };

  const SUBJECT =
    /\b(pottery|ceramics|climb\w*|bouldering|hike|hiking|camping|surf\w*|ski|snowboard|pilates|yoga|marathon|tattoo|piano|guitar|drums|paint\w*|draw\w*|knit\w*|bake|baking|cook\w*|pasta|sushi|ramen|korea|japan|tokyo|seoul|paris|iceland|roadtrip|road trip|concert|festival|museum|exhibition|therapy|driving|license)\b/i;

  const mine: Wish[] = [];
  const theirs: Wish[] = [];

  for (const thread of threads) {
    for (const m of thread.messages) {
      if (!WANT.test(m.text)) continue;
      const subject = m.text.toLowerCase().match(SUBJECT)?.[0];
      if (!subject) continue;
      (m.sender === owner ? mine : theirs).push({ m, thread: thread.name, subject });
    }
  }

  const cards: Card[] = [];
  const used = new Set<string>();

  for (const wish of theirs) {
    const match = mine.find((w) => w.subject === wish.subject);
    if (!match) continue;
    if (used.has(wish.subject)) continue;
    used.add(wish.subject);

    cards.push({
      id: id("both_wanted", wish.m.id, match.m.id),
      kind: "both_wanted",
      score: 0.82,
      rank: null,
      friend: { name: wish.thread, threadId: wish.thread },
      title: `You both wanted to try ${wish.subject}.`,
      body: `They said it once, you said it somewhere else, months apart. Neither of you said it to the other.`,
      stats: [],
      // Oldest first, and each from its own chat.
      evidence: [wish, match]
        .sort((a, b) => a.m.ts - b.m.ts)
        .map((w) => ev(w.m, owner, w.thread, true)),
      action: {
        label: "Do It Together",
        draft: `ok random but we have both separately said we want to try ${wish.subject}. why have we never done this together`,
      },
    });
  }

  return cards.slice(0, 3);
}

function recap(threads: Thread[], owner: string, ties: Tie[], now: number): Card[] {
  return ties.slice(0, 3).map((tie) => {
    const thread = threads.find((t) => t.name === tie.thread)!;
    const stats = wrappedStats([thread], owner, now);
    const messages = [...thread.messages].sort((a, b) => a.ts - b.ts);

    const standout = highlights(thread.messages, 2)
      .flatMap((m) => m.messages.slice(0, 2))
      .slice(0, 3);
    const ids = new Set(standout.map((m) => m.id));

    return {
      id: id("recap", tie.thread),
      kind: "recap",
      score: 0.65,
      rank: null,
      friend: { name: tie.friend, threadId: tie.thread },
      title: `You + ${firstName(tie.friend)}`,
      body: tie.evidence.length
        ? `${tie.totalMessages.toLocaleString()} messages, and ${
            tie.evidence.length
          } things still unfinished between you.`
        : `${tie.totalMessages.toLocaleString()} messages, and ${tie.silenceDays} days of quiet.`,
      stats: [
        { label: "Messages", value: tie.totalMessages.toLocaleString() },
        { label: "Talking since", value: shortDate(messages[0].ts) },
        stats.peakMonth ? { label: "Most active", value: stats.peakMonth.label } : null,
        stats.loudestHour ? { label: "Usual hour", value: stats.loudestHour.label } : null,
        { label: "Quiet for", value: ago(tie.silenceDays) },
      ].filter(Boolean) as { label: string; value: string }[],
      evidence: messages
        .filter((m) => ids.has(m.id))
        .map((m) => ev(m, owner, thread.name, true)),
      action: { label: "Share Recap", draft: null },
    };
  });
}

/* ------------------------------------------------------------------ */

export function buildCards(
  threads: Thread[],
  owner: string,
  now = Date.now()
): CardsEnvelope {
  const ties = analyse(threads, owner, now);

  const cards = [
    ...yourPeople(threads, owner, now),
    ...unanswered(ties, threads, owner),
    ...unfinishedPlans(threads, owner, now),
    ...bothWanted(threads, owner),
    ...memoryLane(threads, owner, ties),
    ...recap(threads, owner, ties, now),
  ];

  return {
    generatedAt: new Date(now).toISOString(),
    owner,
    cards: cards.sort((a, b) => b.score - a.score),
  };
}
