/**
 * The signal engine.
 *
 * Everything here answers one question: which of these friendships is quietly
 * dying, and what is the specific unfinished thing you could say to it?
 *
 * Every signal carries the message ids it came from. Nothing in the UI is
 * allowed to make a claim it cannot point at.
 */

import type { Message, Thread } from "./parse";

const DAY = 86_400_000;

export type Evidence = {
  kind: "open-loop" | "promise" | "want" | "milestone";
  messageId: string;
  ts: number;
  sender: string;
  quote: string;
  /** Why this message was pulled out, in plain language, for the UI. */
  reason: string;
  /** 0-1. Pattern strength before any LLM has looked at it. */
  confidence: number;
};

export type Tie = {
  thread: string;
  friend: string;
  isGroup: boolean;
  totalMessages: number;
  firstTs: number;
  lastTs: number;
  silenceDays: number;
  /** Messages per week at the friendship's busiest 30-day stretch. */
  peakPerWeek: number;
  /** Messages per week over the last 90 days. */
  currentPerWeek: number;
  /** Typical hours between messages back when it was alive. */
  medianGapHours: number;
  /** Share of messages you sent. Far from 0.5 means one of you carried it. */
  yourShare: number;
  decay: number;
  evidence: Evidence[];
};

/* ------------------------------------------------------------------ */
/* cadence                                                             */
/* ------------------------------------------------------------------ */

function perWeekInWindow(messages: Message[], from: number, to: number): number {
  const span = Math.max(to - from, DAY);
  const n = messages.filter((m) => m.ts >= from && m.ts <= to).length;
  return (n / span) * DAY * 7;
}

/** Busiest 30 days the friendship ever had, in messages per week. */
function peakCadence(messages: Message[]): number {
  if (messages.length < 2) return 0;
  const win = 30 * DAY;
  let peak = 0;
  // Messages are sorted, so a two-pointer sweep is enough.
  let lo = 0;
  for (let hi = 0; hi < messages.length; hi++) {
    while (messages[hi].ts - messages[lo].ts > win) lo++;
    peak = Math.max(peak, ((hi - lo + 1) / 30) * 7);
  }
  return peak;
}

function medianGapHours(messages: Message[]): number {
  if (messages.length < 3) return 0;
  const gaps: number[] = [];
  for (let i = 1; i < messages.length; i++) {
    gaps.push(messages[i].ts - messages[i - 1].ts);
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] / 3_600_000;
}

/* ------------------------------------------------------------------ */
/* evidence patterns                                                   */
/* ------------------------------------------------------------------ */

const QUESTION_OPENERS =
  /^(are|is|do|does|did|can|could|would|will|should|have|has|was|were|what|when|where|who|why|how|any|you free|u free|wanna|want to|down to|still)/i;

const PROMISE = [
  { re: /\bwe should\b/i, w: 0.9 },
  { re: /\bwe('| )?(ve)? (gotta|got to|need to|have to)\b/i, w: 0.9 },
  { re: /\blet'?s\s+(?!know|see\b)/i, w: 0.7 },
  { re: /\bnext time\b/i, w: 0.8 },
  { re: /\bwhen (you'?re|ur|i'?m) (back|home|in town|free)\b/i, w: 0.95 },
  { re: /\bwe'?ll (do|go|catch|grab|plan)\b/i, w: 0.8 },
  { re: /\bsometime (soon|this)\b/i, w: 0.7 },
  { re: /\brain ?check\b/i, w: 0.9 },
  { re: /\bi(')?ll (visit|come|swing by|call you)\b/i, w: 0.85 },
];

const WANT = [
  { re: /\bi'?ve always wanted\b/i, w: 0.95 },
  { re: /\bi'?ve been (wanting|meaning) to\b/i, w: 0.9 },
  { re: /\b(dying|desperate) to\b/i, w: 0.85 },
  { re: /\bi'?m obsessed with\b/i, w: 0.8 },
  { re: /\bi really (want|need)\b/i, w: 0.8 },
  { re: /\bon my (bucket ?list|list)\b/i, w: 0.85 },
  { re: /\bi wish i (could|had)\b/i, w: 0.7 },
  { re: /\bsaving up for\b/i, w: 0.8 },
];

const MILESTONE = [
  { re: /\bi (got|landed|accepted)\b.*\b(job|offer|internship|role|place|into)\b/i, w: 0.9 },
  { re: /\b(moving|moved) to\b/i, w: 0.85 },
  { re: /\bi (graduated|got in|got promoted)\b/i, w: 0.9 },
  { re: /\b(broke up|breakup|we split)\b/i, w: 0.8 },
  { re: /\b(started|starting) (at|my|a new)\b/i, w: 0.7 },
];

function words(text: string): number {
  return text.trim().split(/\s+/).length;
}

/**
 * A real question, not filler. Chat is full of "did you see that" and "u up" —
 * they parse as questions but there is nothing in them to answer, so an
 * opener-only match has to earn its place with some actual content.
 */
function isQuestion(text: string): boolean {
  const t = text.trim();
  const w = words(t);
  if (t.includes("?")) return w >= 3;
  // Without a question mark, an opener alone is weak evidence: long ones are
  // almost always statements ("when you're back we're doing the whole day").
  return QUESTION_OPENERS.test(t) && w >= 5 && w <= 12;
}

/**
 * How much there is to answer. A twelve-word question about your interview is
 * worth more than "you free?", so evidence is weighted by substance before it
 * is ranked.
 */
function substance(text: string): number {
  const w = words(text);
  return Math.min(w / 12, 1) * 0.7 + 0.3;
}

function trim(text: string, max = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

function daysBetween(a: number, b: number): number {
  return Math.round(Math.abs(b - a) / DAY);
}

const STOPWORDS = new Set(
  ("the a an and or but if then than that this these those i you he she it we they me him her us them my your his its our their is are was were be been being do does did done have has had will would can could should shall may might must not no yes so just really very much more most some any all about with from into for of on in at to up out off over under again too also still even ever never now then there here what when where who why how which about going get got go went come came know knew think thought want wanted like liked make made take took see saw say said tell told one two lol lmao omg ok okay yeah yea nah hey hi bye thanks thank please sorry").split(
    " "
  )
);

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const w of a) if (b.has(w)) return true;
  return false;
}

/**
 * A question from them that you never actually answered.
 *
 * The naive version — "did they speak again afterwards" — misses the case that
 * hurts most, and that is by far the most common: you kept chatting for weeks
 * and simply never came back to the thing they asked. So instead of looking
 * for any reply, we look for a reply that is *about* the question, by content
 * word overlap. No overlap inside the window means the question was dropped,
 * however much else got said.
 */
function openLoops(messages: Message[], owner: string, now: number): Evidence[] {
  const out: Evidence[] = [];
  const WINDOW = 14 * DAY;

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.sender === owner) continue;
    if (!isQuestion(m.text)) continue;

    const asked = contentWords(m.text);
    if (asked.size === 0) continue; // nothing concrete was asked

    // Did you answer *this*, within a fortnight?
    let answered: Message | undefined;
    let spokeAfter = false;
    for (let j = i + 1; j < messages.length && messages[j].ts - m.ts <= WINDOW; j++) {
      const r = messages[j];
      if (r.sender !== owner) continue;
      spokeAfter = true;
      if (overlaps(asked, contentWords(r.text))) {
        answered = r;
        break;
      }
    }

    if (answered) continue; // genuinely handled

    const silentFor = daysBetween(m.ts, now);

    out.push({
      kind: "open-loop",
      messageId: m.id,
      ts: m.ts,
      sender: m.sender,
      quote: trim(m.text),
      reason: spokeAfter
        ? `${m.sender} asked this ${silentFor} days ago. You kept talking. You never answered it.`
        : `${m.sender} asked this ${silentFor} days ago. You never replied.`,
      // Dropping a question mid-conversation is a stronger signal than going
      // quiet, because you were there and it still went unanswered.
      confidence: (spokeAfter ? 0.95 : 0.85) * substance(m.text),
    });
  }

  return out.sort((a, b) => b.confidence - a.confidence || b.ts - a.ts).slice(0, 6);
}

function matchPatterns(
  messages: Message[],
  patterns: { re: RegExp; w: number }[],
  kind: Evidence["kind"],
  reason: (m: Message) => string
): Evidence[] {
  const out: Evidence[] = [];
  for (const m of messages) {
    if (m.text.length < 12) continue;
    for (const p of patterns) {
      if (!p.re.test(m.text)) continue;
      out.push({
        kind,
        messageId: m.id,
        ts: m.ts,
        sender: m.sender,
        quote: trim(m.text),
        reason: reason(m),
        confidence: p.w * substance(m.text),
      });
      break;
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence || b.ts - a.ts).slice(0, 6);
}

/* ------------------------------------------------------------------ */
/* the tie                                                             */
/* ------------------------------------------------------------------ */

/**
 * Decay ranks friendships by how worth rescuing they are, which is not the
 * same as how neglected they are. Three things combine:
 *
 *   value    what the friendship was — intensity at its peak, plus depth
 *   silence  how overdue it is against its OWN rhythm, not a global constant
 *   handle   whether there is something specific to actually say
 *
 * Silence gates value multiplicatively, so a warm friendship never ranks
 * above a dead one however deep it is. The evidence term is what stops this
 * being a neglect leaderboard: a thread with an unanswered question about
 * someone's job beats a thread with nothing but silence.
 */
function decayScore(
  peakPerWeek: number,
  totalMessages: number,
  silenceDays: number,
  medianGapH: number,
  evidence: Evidence[]
): number {
  if (peakPerWeek === 0) return 0;

  // How intense it ever got. ~20/wk (3 a day) saturates.
  const intensity = Math.min(peakPerWeek / 20, 1);

  // How substantial it was overall. ~3000 messages saturates.
  const depth = Math.min(Math.log10(1 + totalMessages) / Math.log10(3001), 1);

  const value = intensity * 0.6 + depth * 0.4;

  // How many of this friendship's own normal gaps fit inside the silence.
  const normalGapDays = Math.max(medianGapH / 24, 0.25);
  const overdue = silenceDays / normalGapDays;
  const silence = Math.min(Math.log10(1 + overdue) / 4, 1);

  // Do we have a specific thing to open with?
  const best = evidence.map((e) => e.confidence).sort((a, b) => b - a);
  const handle = best.length
    ? Math.min((best[0] + (best[1] ?? 0) * 0.5) / 1.4, 1)
    : 0;

  // Under three weeks is not dormant, whatever the arithmetic says.
  const dormant = silenceDays < 21 ? 0.15 : 1;

  return value * silence * (0.65 + 0.35 * handle) * dormant;
}

/**
 * One message can trip several patterns, and chat repeats itself. Keep the
 * strongest reading of each message and drop repeated phrasings, so the panel
 * shows four different things rather than one thing four times.
 */
function dedupe(evidence: Evidence[]): Evidence[] {
  const byId = new Map<string, Evidence>();
  for (const e of evidence) {
    const prev = byId.get(e.messageId);
    if (!prev || e.confidence > prev.confidence) byId.set(e.messageId, e);
  }

  const seen = new Set<string>();
  return [...byId.values()]
    .sort((a, b) => b.confidence - a.confidence || b.ts - a.ts)
    .filter((e) => {
      const key = e.quote.toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function analyseThread(thread: Thread, owner: string, now = Date.now()): Tie | null {
  const messages = [...thread.messages].sort((a, b) => a.ts - b.ts);
  if (messages.length < 10) return null;

  const others = thread.participants.filter((p) => p !== owner);
  if (!others.length) return null;

  const firstTs = messages[0].ts;
  const lastTs = messages[messages.length - 1].ts;
  const silenceDays = daysBetween(lastTs, now);

  const peak = peakCadence(messages);
  const current = perWeekInWindow(messages, now - 90 * DAY, now);
  const medianGapH = medianGapHours(messages);
  const mine = messages.filter((m) => m.sender === owner).length;

  const evidence = dedupe([
    ...openLoops(messages, owner, now),
    ...matchPatterns(messages, PROMISE, "promise", (m) => {
      const d = daysBetween(m.ts, now);
      return m.sender === owner
        ? `You said this ${d} days ago. It never happened.`
        : `${m.sender} suggested this ${d} days ago. It never happened.`;
    }),
    ...matchPatterns(
      messages,
      WANT,
      "want",
      (m) => `${m.sender === owner ? "You" : m.sender} mentioned wanting this.`
    ),
    ...matchPatterns(
      messages,
      MILESTONE,
      "milestone",
      (m) => `${m.sender === owner ? "You" : m.sender} shared this and it went unremarked.`
    ),
  ]);

  return {
    thread: thread.name,
    friend: thread.isGroup ? thread.name : others[0],
    isGroup: thread.isGroup,
    totalMessages: messages.length,
    firstTs,
    lastTs,
    silenceDays,
    peakPerWeek: Math.round(peak * 10) / 10,
    currentPerWeek: Math.round(current * 10) / 10,
    medianGapHours: Math.round(medianGapH * 10) / 10,
    yourShare: Math.round((mine / messages.length) * 100) / 100,
    decay:
      Math.round(
        decayScore(peak, messages.length, silenceDays, medianGapH, evidence) * 1000
      ) / 1000,
    evidence,
  };
}

export function analyse(threads: Thread[], owner: string, now = Date.now()): Tie[] {
  return threads
    .map((t) => analyseThread(t, owner, now))
    .filter((t): t is Tie => t !== null)
    .sort((a, b) => b.decay - a.decay);
}

/** One sentence a human can read without a legend. */
export function headline(tie: Tie): string {
  const peak = Math.round(tie.peakPerWeek);
  if (peak >= 7) {
    return `You used to talk ${peak}x a week. It's been ${tie.silenceDays} days.`;
  }
  if (peak >= 2) {
    return `You talked most weeks for ${Math.round(
      daysBetween(tie.firstTs, tie.lastTs) / 30
    )} months. It's been ${tie.silenceDays} days.`;
  }
  return `${tie.totalMessages} messages, then ${tie.silenceDays} days of nothing.`;
}
