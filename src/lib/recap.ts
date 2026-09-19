/**
 * Nostalgia recap.
 *
 * The other half of reopening a friendship. The open loops say what you owe
 * someone; this says why it was worth having in the first place, which is the
 * part you cannot remember on demand and the part that makes you actually send
 * the message.
 *
 * Moments are found arithmetically, from how people type rather than from what
 * a model guesses. Laughter leaves a signature, so do 3am conversations and
 * so do the bursts where nobody could type fast enough. A model narrates what
 * this file finds; it never decides what counts.
 */

import type { Message } from "./parse";

const DAY = 86_400_000;

export type Moment = {
  kind: "laughter" | "late-night" | "burst" | "depth" | "first" | "last";
  ts: number;
  /** The messages that make up the moment, in order. */
  messages: { id: string; sender: string; text: string }[];
  label: string;
  score: number;
};

/* ------------------------------------------------------------------ */
/* timezone                                                            */
/* ------------------------------------------------------------------ */

/**
 * WhatsApp writes timestamps in the timezone of the phone doing the exporting,
 * not the timezone the messages were sent in. Export a Hong Kong childhood
 * from a laptop in New York and every conversation lands twelve hours off, so
 * lunchtime reads as 2am and the late-night signal fires on everything.
 *
 * We recover the offset from the one thing every archive contains: people
 * sleep. The quietest six hours of the day are the middle of their night, so
 * we shift the clock until that trough sits where a night belongs. No input
 * needed, and it self-corrects for anyone who moved.
 */
export function inferHourShift(messages: Message[]): number {
  if (messages.length < 100) return 0;

  const bins = new Array(24).fill(0);
  for (const m of messages) bins[new Date(m.ts).getHours()]++;

  let quietest = 0;
  let lowest = Infinity;
  for (let start = 0; start < 24; start++) {
    let total = 0;
    for (let k = 0; k < 6; k++) total += bins[(start + k) % 24];
    if (total < lowest) {
      lowest = total;
      quietest = start;
    }
  }

  // A night that runs 00:00-06:00 needs no correction; anything else is the
  // distance we have to move to put it there.
  let shift = -quietest;
  if (shift < -12) shift += 24;
  if (shift > 12) shift -= 24;
  return shift;
}

function hourOf(ts: number, shift: number): number {
  return (new Date(ts).getHours() + shift + 24) % 24;
}

/* ------------------------------------------------------------------ */

const LAUGH =
  /(😂|🤣|💀|😭|ahaha|hahaha|hahah|lmaoo|lmfao|\blmao\b|\bhaha\b|\blolol|😹|🤪)/i;

/** Emoji and repeated punctuation both mark intensity. */
function intensity(text: string): number {
  const emoji = (text.match(/(😂|🤣|💀|😭|😹|🤪)/gu) ?? []).length;
  const hahas = (text.match(/ha/gi) ?? []).length;
  // Plenty of people never use emoji and are still laughing.
  const words = (text.match(/\b(lmaoo*|lmfao|lol+|dying|crying|screaming|wheez\w*)\b/gi) ?? [])
    .length;
  const bangs = (text.match(/[!?]{2,}/g) ?? []).length;
  const caps = /\b[A-Z]{4,}\b/.test(text) ? 1 : 0;
  return emoji * 2 + Math.min(hahas, 6) + words * 2 + bangs + caps;
}

function trim(text: string, max = 180): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

function window(messages: Message[], i: number, span = 6): Message[] {
  return messages.slice(Math.max(0, i - 1), Math.min(messages.length, i + span));
}

function toMoment(
  kind: Moment["kind"],
  slice: Message[],
  label: string,
  score: number
): Moment {
  return {
    kind,
    ts: slice[0].ts,
    messages: slice.map((m) => ({ id: m.id, sender: m.sender, text: trim(m.text) })),
    label,
    score,
  };
}

/* ------------------------------------------------------------------ */

/**
 * Stretches where both of you were laughing. One person sending a crying
 * emoji is a reaction; both of you doing it for six messages is a moment.
 */
function laughter(messages: Message[]): Moment[] {
  const out: Moment[] = [];

  for (let i = 0; i < messages.length; i++) {
    if (!LAUGH.test(messages[i].text)) continue;

    const slice = window(messages, i);
    const laughing = slice.filter((m) => LAUGH.test(m.text));
    if (laughing.length < 2) continue;

    // Both of you, not one person spamming.
    if (new Set(laughing.map((m) => m.sender)).size < 2) continue;

    const score = laughing.reduce((n, m) => n + intensity(m.text), 0);
    if (score < 4) continue;

    out.push(toMoment("laughter", slice, "You could not stop laughing", score));
    i += slice.length; // do not re-report the same stretch
  }

  return out;
}

/** Conversations that ran past 2am. Nobody stays up for someone they are indifferent to. */
function lateNight(messages: Message[], shift: number): Moment[] {
  const out: Moment[] = [];

  for (let i = 0; i < messages.length; i++) {
    const hour = hourOf(messages[i].ts, shift);
    if (hour < 2 || hour > 5) continue;

    // One night, not every 3am across three years: the moment has to be a
    // single unbroken conversation.
    const slice = window(messages, i, 8).filter(
      (m) =>
        Math.abs(m.ts - messages[i].ts) < 3 * 3_600_000 &&
        hourOf(m.ts, shift) >= 1 &&
        hourOf(m.ts, shift) <= 6
    );

    if (slice.length < 5) continue;
    if (new Set(slice.map((m) => m.sender)).size < 2) continue;

    const words = slice.reduce((n, m) => n + m.text.split(/\s+/).length, 0);
    if (words < 40) continue; // half-asleep one-liners are not a conversation

    out.push(
      toMoment("late-night", slice, `Still talking at ${hour}am`, words / 10 + slice.length)
    );
    i += slice.length;
  }

  return out;
}

/**
 * Bursts where neither of you could type fast enough. Measured against this
 * friendship's own pace, so a pair who always reply instantly do not register
 * as permanently excited.
 */
function bursts(messages: Message[], medianGapMs: number): Moment[] {
  const out: Moment[] = [];
  const fast = Math.max(medianGapMs / 3, 10_000);

  let run: Message[] = [];
  const flush = () => {
    if (run.length >= 8 && new Set(run.map((m) => m.sender)).size >= 2) {
      const span = (run[run.length - 1].ts - run[0].ts) / 1000;
      out.push(
        toMoment(
          "burst",
          run.slice(0, 8),
          `${run.length} messages in ${Math.max(1, Math.round(span / 60))} minutes`,
          run.length
        )
      );
    }
    run = [];
  };

  for (let i = 1; i < messages.length; i++) {
    if (messages[i].ts - messages[i - 1].ts <= fast) {
      if (!run.length) run.push(messages[i - 1]);
      run.push(messages[i]);
    } else {
      flush();
    }
  }
  flush();

  return out;
}

/**
 * The messages somebody stopped to actually write. Chat is short by default,
 * so a paragraph is a deliberate act: it is where the apologies, the news and
 * the things people could not say in one line ended up.
 */
function depth(messages: Message[]): Moment[] {
  const lengths = messages.map((m) => m.text.length).sort((a, b) => a - b);
  if (lengths.length < 50) return [];

  // Long relative to how this pair normally writes, not an absolute count.
  const p95 = lengths[Math.floor(lengths.length * 0.95)];
  const bar = Math.max(p95, 180);

  const out: Moment[] = [];
  // People resend things. The same paragraph twice is one moment, not two.
  const seen = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].text.length < bar) continue;

    const key = messages[i].text.slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const slice = window(messages, i, 3);
    out.push(
      toMoment("depth", slice, "Someone stopped to actually write", messages[i].text.length / 40)
    );
    i += 3;
  }
  return out;
}

/* ------------------------------------------------------------------ */

function medianGap(messages: Message[]): number {
  if (messages.length < 3) return 60_000;
  const gaps: number[] = [];
  for (let i = 1; i < messages.length; i++) gaps.push(messages[i].ts - messages[i - 1].ts);
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] || 60_000;
}

/**
 * The shape of a friendship in a handful of moments, spread across its whole
 * life rather than clustered in whichever month happened to score highest.
 */
export function highlights(messages: Message[], limit = 6): Moment[] {
  const sorted = [...messages].sort((a, b) => a.ts - b.ts);
  if (sorted.length < 20) return [];

  const gap = medianGap(sorted);
  const shift = inferHourShift(sorted);
  const found = [
    ...laughter(sorted),
    ...lateNight(sorted, shift),
    ...bursts(sorted, gap),
    ...depth(sorted),
  ].sort((a, b) => b.score - a.score);

  if (!found.length) return [];

  // Build the pool kind by kind, not by raw score. Laughter is the loudest
  // signal in almost every archive, so scoring alone returns six versions of
  // the same joke and never the night someone said something true.
  const perKind = Math.max(2, Math.ceil(limit / 2));
  const byKind = new Map<Moment["kind"], Moment[]>();
  for (const m of found) {
    const list = byKind.get(m.kind) ?? [];
    if (list.length < perKind) list.push(m);
    byKind.set(m.kind, list);
  }
  const pool = [...byKind.values()].flat();

  // Then spread what survives across the friendship's life, so a recap is not
  // six scenes from one summer.
  const span = sorted[sorted.length - 1].ts - sorted[0].ts;
  const bucketSize = Math.max(span / limit, 30 * DAY);
  const taken = new Map<number, Moment>();

  for (const m of pool.sort((a, b) => b.score - a.score)) {
    const bucket = Math.floor((m.ts - sorted[0].ts) / bucketSize);
    if (!taken.has(bucket)) taken.set(bucket, m);
  }

  const picked = [...taken.values()];

  // Top up from the rest of the pool if the timeline was sparse.
  for (const m of pool) {
    if (picked.length >= limit) break;
    if (!picked.includes(m)) picked.push(m);
  }

  return picked.sort((a, b) => a.ts - b.ts).slice(0, limit);
}

/** The first thing either of you ever said, which is almost always funny in hindsight. */
export function bookends(messages: Message[]): { first: Moment; last: Moment } | null {
  const sorted = [...messages].sort((a, b) => a.ts - b.ts);
  if (sorted.length < 20) return null;

  // "fr" is a real first message and a terrible opening line. Start on the
  // first thing either of you actually said, within the opening exchange.
  const opening = sorted.slice(0, 60);
  const substantive = opening.findIndex((m) => m.text.split(/\s+/).length >= 5);
  const from = substantive >= 0 ? substantive : 0;

  return {
    first: toMoment("first", sorted.slice(from, from + 4), "How it started", 0),
    last: toMoment("last", sorted.slice(-3), "The last thing either of you said", 0),
  };
}
