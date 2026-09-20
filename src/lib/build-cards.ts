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
import { analyse, contentWords, type Tie } from "./signals.ts";
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

    // Every time it came up, all of them the point of the card. Quoting only
    // the longest one loses the fact that makes the card: it kept happening.
    const raised = new Set(p.messageIds);
    const mentions = messages
      .filter((m) => raised.has(m.id))
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
 * The things two people have in common that are worth naming: hobbies, places,
 * the shared project. Deliberately a closed list. An open one turns every
 * common noun into a "shared interest" and the cards stop meaning anything.
 */
const SUBJECT =
  /\b(pottery|ceramics|climb\w*|bouldering|hike|hiking|camping|surf\w*|ski|snowboard|pilates|yoga|marathon|tattoo|piano|guitar|drums|paint\w*|draw\w*|knit\w*|bake|baking|cooking|pasta|sushi|ramen|korea|japan|tokyo|seoul|paris|iceland|roadtrip|road trip|concert|festival|museum|exhibition|therapy|driving|license)\b/i;

/**
 * A topic the two of you used to share and stopped talking about.
 *
 * Not a plan and not a question: a subject that ran through the conversation
 * for a while and then went quiet, which is the thing you can pick back up
 * without apologising for anything first.
 *
 * The bar is deliberately high. It must have come up at least three times, on
 * at least three different days, by both of you, and the last time must be a
 * long while ago. Two mentions is a coincidence; one-sided is a monologue.
 */
/** Topics an unfinished-plans card already shows, so nothing is found twice. */
function plannedSubjects(plans: Card[]): Set<string> {
  const out = new Set<string>();
  for (const card of plans) {
    for (const e of card.evidence) {
      const subject = e.text.toLowerCase().match(SUBJECT)?.[0];
      if (subject) out.add(`${card.friend.threadId}::${subject}`);
    }
  }
  return out;
}

function pick3(days: Message[], owner: string): Message[] {
  const first = days[0];
  const last = days[days.length - 1];
  const middle = days
    .slice(1, -1)
    .find((m) => (m.sender === owner) !== (first.sender === owner)) ?? days[Math.floor(days.length / 2)];
  return [first, middle, last];
}

function reconnect(threads: Thread[], owner: string, now: number, taken: Set<string>): Card[] {
  const QUIET = 180 * 86_400_000;
  const cards: Card[] = [];

  for (const thread of threads) {
    const bySubject = new Map<string, Message[]>();

    for (const m of thread.messages) {
      const subject = m.text.toLowerCase().match(SUBJECT)?.[0];
      if (!subject) continue;
      const list = bySubject.get(subject) ?? [];
      list.push(m);
      bySubject.set(subject, list);
    }

    let best: { subject: string; days: Message[] } | null = null;

    for (const [subject, raw] of bySubject) {
      const mentions = [...raw].sort((a, b) => a.ts - b.ts);

      // One a day at most, so a single excited evening is not a running theme.
      const days: Message[] = [];
      for (const m of mentions) {
        const last = days[days.length - 1];
        if (!last || new Date(m.ts).toDateString() !== new Date(last.ts).toDateString()) {
          days.push(m);
        }
      }
      if (days.length < 3) continue;

      // Both of you, or it was never shared.
      if (!days.some((m) => m.sender === owner)) continue;
      if (!days.some((m) => m.sender !== owner)) continue;

      // And it has to have actually stopped.
      if (now - days[days.length - 1].ts < QUIET) continue;

      // If the plans card already shows this exact topic in this exact chat,
      // it is one finding, not two.
      if (taken.has(`${thread.name}::${subject}`)) continue;

      if (!best || days.length > best.days.length) best = { subject, days };
    }

    if (!best) continue;

    const friend = thread.participants.find((p) => p !== owner) ?? thread.name;
    const last = best.days[best.days.length - 1];
    const daysSince = Math.round((now - last.ts) / 86_400_000);

    // Oldest, middle, newest: the shape of a topic fading out.
    // Oldest, then the other person's voice, then the last time it came up:
    // the shape of a topic fading out, with both of you visibly in it.
    const shown = best.days.length <= 3 ? best.days : pick3(best.days, owner);

    cards.push({
      id: id("reconnect", thread.name, best.subject),
      kind: "reconnect",
      score: Math.round(Math.min(0.55 + best.days.length * 0.05, 0.9) * 100) / 100,
      rank: null,
      friend: { name: friend, threadId: thread.name },
      title: `You used to talk about ${best.subject}.`,
      body: `It came up ${best.days.length} times between you, and then it stopped. Neither of you has mentioned it since ${monthYear(last.ts)}, ${ago(daysSince)}.`,
      stats: [
        { label: "Times mentioned", value: `${best.days.length}` },
        { label: "Last mentioned", value: monthYear(last.ts) },
      ],
      evidence: shown.map((m) => ev(m, owner, thread.name, true)),
      action: {
        label: "Reconnect",
        draft: `random question but are you still doing the ${best.subject} thing? it came up and i realised i have no idea where you landed with it`,
      },
    });
  }

  return cards.sort((a, b) => b.score - a.score).slice(0, 3);
}

/**
 * Something both people independently said they wanted, possibly in different
 * chats. This is the card that needs the whole archive at once: the two halves
 * are in different conversations, so no single thread contains the finding.
 */
/** The wish itself: up to the end of the sentence, and no further. */
function clause(rest: string): string {
  const stop = rest.search(/[.!?;\n]|\band\b|\bbut\b|\bcuz\b|\bbecause\b/i);
  return (stop > 0 ? rest.slice(0, stop) : rest).split(/\s+/).slice(0, 12).join(" ");
}

/** How much two wishes are actually about the same thing. */
function shareWords(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

function bothWanted(threads: Thread[], owner: string): Card[] {
  /** "to Priya" reads wrong for a group chat, "in crit group" for a person. */
  const where = (w: { thread: string; oneToOne: boolean }) =>
    w.oneToOne ? `to ${firstName(w.thread)}` : `in ${w.thread}`;

  const WANT =
    /\b(i'?ve always wanted|i'?ve been wanting|i really want|i'?m dying to|dying to|i wish i could|i want to try|i'?d love to|i'?m interested in|i really wanna)\b/i;

  /**
   * "i'd love to come see you" is an acceptance, not a wish. So is "i'd love
   * to help". They are the most common shape this phrase takes in real chats
   * and pairing on them produces nonsense.
   */
  const REPLY = /\b(to|and)?\s*(come|join|help|meet|see|visit|talk|chat|hear|work)\s+(you|u|with|too|there|again|back|out)\b/i;

  type Wish = { m: Message; thread: string; words: Set<string>; oneToOne: boolean };

  const mine: Wish[] = [];
  const theirs: Wish[] = [];

  for (const thread of threads) {
    for (const m of thread.messages) {
      const hit = m.text.match(WANT);
      if (!hit || hit.index === undefined) continue;

      // Only the clause after the phrase. Taking the whole rest of a long
      // message lets two unrelated paragraphs share words by accident, which
      // is how "watch it for the first time" paired with "get my academics
      // done first". A wish says what it is about immediately.
      const object = clause(m.text.slice(hit.index + hit[0].length));
      if (REPLY.test(object)) continue;

      // A wish needs something to be about. "IVE ALWAYS WANTED TO TRY" and
      // "i wish i could lmfao" are reflexes, and there are far more of them
      // in a real archive than there are real wishes.
      const words = contentWords(object);
      if (words.size < 1) continue;

      (m.sender === owner ? mine : theirs).push({
        m,
        thread: thread.name,
        words,
        oneToOne: thread.participants.length <= 2,
      });
    }
  }

  const cards: Card[] = [];
  const used = new Set<string>();

  for (const wish of theirs) {
    // Said in a different conversation, or it is not a discovery: if it was
    // the same chat then you both already know.
    const match = mine.find(
      (w) => w.thread !== wish.thread && shareWords(w.words, wish.words) >= 2
    );
    if (!match) continue;

    const shared = [...wish.words].filter((w) => match.words.has(w)).sort().join("+");
    if (used.has(shared)) continue;
    used.add(shared);

    cards.push({
      id: id("both_wanted", wish.m.id, match.m.id),
      kind: "both_wanted",
      score: 0.82,
      rank: null,
      friend: { name: wish.m.sender, threadId: wish.thread },
      // The shared word is whatever the two sentences happened to use, so
      // never bend a title around it. The quotes say what it was.
      title: `You both wanted this. Separately.`,
      body: `${firstName(wish.m.sender)} said it ${
        // "Jonas said it to Jonas" is nonsense: his 1:1 is just "this chat".
        wish.oneToOne ? "in this chat" : `in ${wish.thread}`
      }. You said the same thing ${where(match)}, months apart. Neither of you ever put the two together.`,
      stats: [],
      // Oldest first, and each from its own chat.
      evidence: [wish, match]
        .sort((a, b) => a.m.ts - b.m.ts)
        .map((w) => ev(w.m, owner, w.thread, true)),
      action: {
        label: "Do It Together",
        draft: `ok random but we have separately said the exact same thing about this. why have we never just done it together`,
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

  // Plans run first: a topic they already claim is not also a reconnect.
  const plans = unfinishedPlans(threads, owner, now);

  const cards = [
    ...yourPeople(threads, owner, now),
    ...unanswered(ties, threads, owner),
    ...plans,
    ...reconnect(threads, owner, now, plannedSubjects(plans)),
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
