/**
 * Closeness.
 *
 * The inverse question to decay: not which friendships are dying, but which
 * ones are real. Volume alone answers it badly, because the person you message
 * most is often a group project, a landlord, or a cofounder.
 *
 * So closeness is scored on six things, each one computed separately and each
 * one shown to the user with the evidence behind it. A single number nobody can
 * argue with is worse than six numbers somebody can disagree with, and
 * "97% best friend" is exactly the kind of invented confidence this whole
 * project is built to avoid.
 */

import type { Message, Thread } from "./parse";

const DAY = 86_400_000;

export type Factor = {
  key: "reciprocity" | "depth" | "warmth" | "candour" | "longevity" | "personal";
  label: string;
  /** 0-1. */
  score: number;
  /** One sentence, in the numbers this friendship actually produced. */
  detail: string;
};

export type Closeness = {
  thread: string;
  friend: string;
  isGroup: boolean;
  score: number;
  totalMessages: number;
  factors: Factor[];
  /** The message that best shows why this friendship scored the way it did. */
  exhibit: { text: string; sender: string; ts: number } | null;
};

/* ------------------------------------------------------------------ */

const WARMTH =
  /(😂|🤣|💀|😭|❤|🥹|🥰|😊|🫶|😘|hahaha|lmaoo|\blmao\b|\bily\b|love you|miss you|proud of you|thank you so much|so happy for you|congrats)/i;

/**
 * Deliberately excludes "honestly" and "tbh". Both are filler in casual chat,
 * and counting them scored every thread at maximum candour, which made the
 * factor useless.
 */
const CANDOUR =
  /\b(i'?m scared|i'?m anxious|i'?m struggling|i cried|i'?m crying|i can'?t cope|i'?m not ok|i'?m not okay|i'?m exhausted|i'?m so tired|burnt? out|burning out|overwhelmed|can'?t sleep|i'?m stressed|so stressed|i'?m worried|i feel like|i felt|i don'?t know what to do|idk what to do|between us|don'?t tell|i'?ve never told|i need help|i'?m sorry for|i miss you|i love you|proud of you|i was hurt|i hate that|it really hurt)\b/i;

const LOGISTICS =
  /\b(deadline|due|hand ?in|submit|assignment|homework|essay|coursework|marks|grading|exam|quiz|slides?|presentation|google (doc|drive)|spreadsheet|meeting|agenda|invoice|shift|roster|client|standup|sprint|ticket|pull request|deploy|the team|action items?)\b/i;

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function share(messages: Message[], re: RegExp): number {
  if (!messages.length) return 0;
  return messages.filter((m) => re.test(m.text)).length / messages.length;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/* ------------------------------------------------------------------ */

/**
 * `corpusMedianLength` lets depth be judged against how this person writes to
 * everybody, rather than an absolute word count that would rank a terse friend
 * below a wordy acquaintance.
 */
function factorsFor(
  messages: Message[],
  owner: string,
  corpusMedianLength: number,
  now: number
): Factor[] {
  const mine = messages.filter((m) => m.sender === owner).length;
  const yourShare = mine / messages.length;

  // 1. Reciprocity. A friendship is two people talking; anything far from even
  //    is one person performing and the other receiving.
  const balance = 1 - Math.min(Math.abs(yourShare - 0.5) * 2, 1);

  // 2. Depth. Long messages against this person's own baseline.
  const lengths = messages.map((m) => m.text.length);
  const depthRatio = median(lengths) / Math.max(corpusMedianLength, 1);
  const depth = Math.min(depthRatio / 2.5, 1);

  // 3. Warmth. Laughter and affection, from both sides.
  const warmthShare = share(messages, WARMTH);
  const bothWarm =
    new Set(messages.filter((m) => WARMTH.test(m.text)).map((m) => m.sender)).size >= 2;
  const warmth = Math.min(warmthShare * 8, 1) * (bothWarm ? 1 : 0.5);

  // 4. Candour. The things people only say to people they trust. Rare by
  //    nature, so it saturates fast.
  const candourShare = share(messages, CANDOUR);
  const candour = Math.min(candourShare * 30, 1);

  // 5. Longevity. Friendships that survived years mean more than a busy month.
  const span = messages[messages.length - 1].ts - messages[0].ts;
  const years = span / (365 * DAY);
  const longevity = Math.min(years / 1.5, 1);

  // 6. Personal. The answer to "we message constantly, but only about work".
  const logisticsShare = share(messages, LOGISTICS);
  const personal = 1 - Math.min(logisticsShare * 4, 1);

  return [
    {
      key: "reciprocity",
      label: "Reciprocity",
      score: balance,
      detail:
        Math.abs(yourShare - 0.5) < 0.08
          ? `Almost exactly even, you sent ${pct(yourShare)}.`
          : yourShare > 0.5
            ? `You sent ${pct(yourShare)} of it. You carry this one.`
            : `They sent ${pct(1 - yourShare)} of it. They carry this one.`,
    },
    {
      key: "depth",
      label: "Depth",
      score: depth,
      detail:
        depthRatio >= 1.3
          ? `Your messages here run ${depthRatio.toFixed(1)}x longer than you write to anyone else.`
          : depthRatio <= 0.7
            ? "Short messages, mostly. Quick exchanges rather than conversations."
            : "About as long as you write to everyone else.",
    },
    {
      key: "warmth",
      label: "Warmth",
      score: warmth,
      detail: bothWarm
        ? `${pct(warmthShare)} of messages carry laughter or affection, from both of you.`
        : `${pct(warmthShare)} carry warmth, but only one of you sends it.`,
    },
    {
      key: "candour",
      label: "Candour",
      score: candour,
      detail:
        candour > 0.5
          ? "Full of the things people only say to people they trust."
          : candourShare > 0.002
            ? "Has its unguarded moments."
            : "Nothing especially unguarded in here.",
    },
    {
      key: "longevity",
      label: "Longevity",
      score: longevity,
      detail:
        years >= 1
          ? `${years.toFixed(1)} years of history.`
          : `${Math.round(span / DAY)} days of history.`,
    },
    {
      key: "personal",
      label: "Not about work",
      score: personal,
      detail:
        logisticsShare > 0.12
          ? `${pct(logisticsShare)} of this is logistics. This reads more like a colleague.`
          : "Barely any logistics. This is a friendship, not a working relationship.",
    },
  ];
}

const WEIGHTS: Record<Factor["key"], number> = {
  reciprocity: 0.2,
  depth: 0.15,
  warmth: 0.2,
  candour: 0.15,
  longevity: 0.15,
  personal: 0.15,
};

/** The single message that best illustrates the friendship's strongest factor. */
function exhibitFor(messages: Message[], top: Factor["key"]) {
  const re =
    top === "candour" ? CANDOUR : top === "warmth" ? WARMTH : top === "personal" ? null : null;

  const pool = re ? messages.filter((m) => re.test(m.text) && m.text.length > 25) : [];
  const chosen =
    pool.sort((a, b) => b.text.length - a.text.length)[0] ??
    [...messages].sort((a, b) => b.text.length - a.text.length)[0];

  if (!chosen) return null;
  return {
    text: chosen.text.slice(0, 220),
    sender: chosen.sender,
    ts: chosen.ts,
  };
}

/* ------------------------------------------------------------------ */

export function closeness(
  threads: Thread[],
  owner: string,
  now = Date.now()
): Closeness[] {
  // One baseline for how this person writes, so depth is relative to them.
  const allLengths = threads.flatMap((t) =>
    t.messages.filter((m) => m.sender === owner).map((m) => m.text.length)
  );
  const corpusMedianLength = median(allLengths) || 20;

  const out: Closeness[] = [];

  for (const thread of threads) {
    const messages = [...thread.messages].sort((a, b) => a.ts - b.ts);
    if (messages.length < 40) continue; // too little to say anything honest

    const others = thread.participants.filter((p) => p !== owner);
    if (!others.length) continue;

    // Deleted accounts all export under the same placeholder, so they are not
    // one friend and cannot be ranked as one.
    if (/^instagram user$/i.test(thread.name)) continue;

    const factors = factorsFor(messages, owner, corpusMedianLength, now);
    const score = factors.reduce((n, f) => n + f.score * WEIGHTS[f.key], 0);

    const top = [...factors].sort((a, b) => b.score - a.score)[0];

    out.push({
      thread: thread.name,
      friend: thread.isGroup ? thread.name : others[0],
      isGroup: thread.isGroup,
      score: Math.round(score * 1000) / 1000,
      totalMessages: messages.length,
      factors,
      exhibit: exhibitFor(messages, top.key),
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

/** One line a person can read without a legend. */
export function closenessHeadline(c: Closeness): string {
  const ranked = [...c.factors].sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  if (best.score < 0.35) {
    return "Plenty of messages, not much of a friendship in them.";
  }

  const strength: Record<Factor["key"], string> = {
    reciprocity: "evenly matched",
    depth: "you write properly to each other",
    warmth: "mostly laughter",
    candour: "you tell each other the real things",
    longevity: "years of it",
    personal: "never about work",
  };

  const weakness: Record<Factor["key"], string> = {
    reciprocity: "one of you carries it",
    depth: "but it stays shallow",
    warmth: "but not much warmth",
    candour: "but nothing unguarded",
    longevity: "but not for long",
    personal: "but it is mostly logistics",
  };

  return worst.score < 0.3
    ? `${strength[best.key]}, ${weakness[worst.key]}.`
    : `${strength[best.key]}.`;
}
