/**
 * Wrapped statistics.
 *
 * Everything here is counted from the archive. Nothing is estimated, nothing is
 * a percentile against other users we do not have, and nothing is a score we
 * invented a scale for. If a number appears on a Wrapped slide it is because
 * this file counted it, and the message ids are carried along so any of it can
 * be clicked back to the original.
 */

import type { Message, Thread } from "./parse.ts";
import { inferHourShift } from "./recap.ts";

const DAY = 86_400_000;

export type MonthBucket = { month: string; label: string; count: number };

export type FunnyMessage = {
  messageId: string;
  thread: string;
  sender: string;
  text: string;
  reactions: number;
  at: string;
};

export type RepeatedPlan = {
  thread: string;
  friend: string;
  quote: string;
  messageId: string;
  /** How many separate times this plan was raised. */
  times: number;
  lastAt: string;
  daysSince: number;
};

export type WrappedStats = {
  totals: {
    conversations: number;
    messages: number;
    sent: number;
    received: number;
  };
  /** The hour you send most, corrected for the export's timezone. */
  loudestHour: { hour: number; label: string; count: number } | null;
  timezoneShiftHours: number;
  byMonth: MonthBucket[];
  peakMonth: MonthBucket | null;
  /** Longest run of consecutive days with at least one message. */
  longestStreak: { days: number; thread: string; from: string; to: string } | null;
  /** Median minutes before you reply, per friend. */
  replySpeed: { fastest: { thread: string; medianMinutes: number } | null; slowest: { thread: string; medianMinutes: number } | null };
  funniest: FunnyMessage[];
  repeatedPlans: RepeatedPlan[];
  /** Questions they asked you, and how many you never came back to. */
  questions: { askedOfYou: number; unanswered: number };
};

/* ------------------------------------------------------------------ */

const MONTH_LABELS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function iso(ts: number): string {
  return new Date(ts).toISOString();
}

function hourLabel(h: number): string {
  const ampm = h >= 12 ? "pm" : "am";
  const twelve = h % 12 || 12;
  return `${twelve}${ampm}`;
}

/* ------------------------------------------------------------------ */

function byMonth(messages: Message[]): MonthBucket[] {
  const counts = new Map<string, number>();
  for (const m of messages) {
    const d = new Date(m.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({
      month,
      label: MONTH_LABELS[Number(month.slice(5)) - 1],
      count,
    }));
}

function loudestHour(messages: Message[], shift: number) {
  const bins = new Array(24).fill(0);
  for (const m of messages) bins[(new Date(m.ts).getHours() + shift + 24) % 24]++;

  let best = 0;
  for (let h = 1; h < 24; h++) if (bins[h] > bins[best]) best = h;
  if (!bins[best]) return null;

  return { hour: best, label: hourLabel(best), count: bins[best] };
}

/** Longest run of consecutive days with at least one message in one thread. */
function longestStreak(threads: Thread[]) {
  let best: WrappedStats["longestStreak"] = null;

  for (const thread of threads) {
    const days = [
      ...new Set(
        thread.messages.map((m) => Math.floor(new Date(m.ts).setHours(0, 0, 0, 0) / DAY))
      ),
    ].sort((a, b) => a - b);

    let run = 1;
    let start = days[0];

    for (let i = 1; i <= days.length; i++) {
      if (i < days.length && days[i] === days[i - 1] + 1) {
        run++;
        continue;
      }
      if (!best || run > best.days) {
        best = {
          days: run,
          thread: thread.name,
          from: iso(start * DAY),
          to: iso(days[i - 1] * DAY),
        };
      }
      if (i < days.length) {
        run = 1;
        start = days[i];
      }
    }
  }

  return best && best.days > 1 ? best : null;
}

/** Median minutes before you reply to them, per thread. */
function replySpeed(threads: Thread[], owner: string) {
  const perThread: { thread: string; medianMinutes: number }[] = [];

  for (const thread of threads) {
    if (thread.isGroup) continue; // a group reply is not a reply to one person
    const messages = [...thread.messages].sort((a, b) => a.ts - b.ts);
    const gaps: number[] = [];

    for (let i = 1; i < messages.length; i++) {
      // Their message, then yours: that gap is a reply.
      if (messages[i].sender !== owner || messages[i - 1].sender === owner) continue;
      const minutes = (messages[i].ts - messages[i - 1].ts) / 60_000;
      // Anything over a day is a new conversation, not a slow reply.
      if (minutes > 24 * 60) continue;
      gaps.push(minutes);
    }

    if (gaps.length >= 20) {
      perThread.push({ thread: thread.name, medianMinutes: Math.round(median(gaps)) });
    }
  }

  if (!perThread.length) return { fastest: null, slowest: null };

  const sorted = [...perThread].sort((a, b) => a.medianMinutes - b.medianMinutes);
  return { fastest: sorted[0], slowest: sorted[sorted.length - 1] };
}

/**
 * Your messages that other people reacted to most, scored per recipient rather
 * than on raw count so a busy group chat does not drown out the one-on-ones.
 */
function funniest(threads: Thread[], owner: string, limit = 5): FunnyMessage[] {
  const out: FunnyMessage[] = [];

  for (const thread of threads) {
    const audience = Math.max(thread.participants.length - 1, 1);
    for (const m of thread.messages) {
      if (m.sender !== owner) continue;
      if (!m.reactions) continue;
      if (m.text.length < 15) continue;
      out.push({
        messageId: m.id,
        thread: thread.name,
        sender: m.sender,
        text: m.text,
        // Store the raw count; rank on the per-head share.
        reactions: m.reactions,
        at: iso(m.ts),
      });
      // Ranking key stashed on the object so the sort below can use it.
      (out[out.length - 1] as any)._share = m.reactions / audience;
    }
  }

  return out
    .sort((a, b) => (b as any)._share - (a as any)._share || b.reactions - a.reactions)
    .slice(0, limit)
    .map(({ ...rest }) => rest);
}

const PLAN =
  /\b(we should|we have to|we gotta|we need to|let'?s|next time|we'?ll do|rain ?check)\b/i;

const ACTIVITY =
  /\b(meet ?up|meet|catch ?up|hang ?out|hang|dinner|lunch|brunch|coffee|drinks?|eat|food|restaurant|bar|movie|film|concert|gig|show|trip|travel|visit|come over|call|party|birthday|beach|hike|walk|gym|swim|museum|exhibition|gallery|pottery|ceramics|cook|bake|game|karaoke|shopping|market|road ?trip|weekend|camping|climb)\b/i;

/** The words that say what the plan actually was. */
function planSubject(text: string): string[] {
  const m = text.toLowerCase().match(ACTIVITY);
  return m ? [m[0].replace(/\s+/g, " ")] : [];
}

/**
 * Plans raised more than once. "We should get dinner" said five times over two
 * years is a different and much funnier fact than it said once, and it is the
 * number that makes people actually book the thing.
 */
function repeatedPlans(
  threads: Thread[],
  now: number,
  limit = 6
): RepeatedPlan[] {
  const out: RepeatedPlan[] = [];

  for (const thread of threads) {
    // Group this thread's plans by what they were about.
    const groups = new Map<string, Message[]>();

    for (const m of thread.messages) {
      if (!PLAN.test(m.text) || !ACTIVITY.test(m.text)) continue;
      for (const subject of planSubject(m.text)) {
        const list = groups.get(subject) ?? [];
        list.push(m);
        groups.set(subject, list);
      }
    }

    for (const [, raised] of groups) {
      if (raised.length < 2) continue;

      // Two messages a minute apart are one plan, not two.
      const distinct: Message[] = [];
      for (const m of raised.sort((a, b) => a.ts - b.ts)) {
        if (!distinct.length || m.ts - distinct[distinct.length - 1].ts > DAY) {
          distinct.push(m);
        }
      }
      if (distinct.length < 2) continue;

      const last = distinct[distinct.length - 1];
      const longest = [...distinct].sort((a, b) => b.text.length - a.text.length)[0];

      out.push({
        thread: thread.name,
        friend: thread.name,
        quote: longest.text.slice(0, 180),
        messageId: longest.id,
        times: distinct.length,
        lastAt: iso(last.ts),
        daysSince: Math.round((now - last.ts) / DAY),
      });
    }
  }

  return out.sort((a, b) => b.times - a.times || b.daysSince - a.daysSince).slice(0, limit);
}

/* ------------------------------------------------------------------ */

export function wrappedStats(
  threads: Thread[],
  owner: string,
  now = Date.now()
): WrappedStats {
  const all = threads.flatMap((t) => t.messages);
  const shift = inferHourShift(all);
  const mine = all.filter((m) => m.sender === owner);

  const months = byMonth(all);
  const peak = months.length
    ? months.reduce((a, b) => (b.count > a.count ? b : a))
    : null;

  return {
    totals: {
      conversations: threads.length,
      messages: all.length,
      sent: mine.length,
      received: all.length - mine.length,
    },
    loudestHour: loudestHour(mine, shift),
    timezoneShiftHours: shift,
    byMonth: months,
    peakMonth: peak,
    longestStreak: longestStreak(threads),
    replySpeed: replySpeed(threads, owner),
    funniest: funniest(threads, owner),
    repeatedPlans: repeatedPlans(threads, now),
    questions: { askedOfYou: 0, unanswered: 0 },
  };
}
