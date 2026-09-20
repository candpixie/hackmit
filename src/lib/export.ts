/**
 * The whole analysis as one JSON document.
 *
 * Every route returns JSON already, but they return a slice each and two of
 * them need a live session. This assembles one self-contained object so the
 * rest of the team can consume the insights without driving the app: a
 * dashboard, the demo video overlay, or anything else downstream.
 *
 * Shape is versioned. Anything reading this should check `schema`.
 */

import type { Thread } from "./parse.ts";
import { analyse, headline, type Evidence } from "./signals.ts";
import { closeness, closenessHeadline } from "./closeness.ts";
import { bookends, highlights, inferHourShift } from "./recap.ts";

export const SCHEMA = "overdue.insights.v1";

export type ExportedEvidence = {
  kind: Evidence["kind"];
  messageId: string;
  at: string;
  sender: string;
  quote: string;
  /** Why this was pulled out, in plain language. */
  reason: string;
  confidence: number;
};

export type ExportedTie = {
  thread: string;
  friend: string;
  isGroup: boolean;
  /** 0-1. How worth rescuing this friendship is. */
  decay: number;
  band: "dormant" | "slipping" | "warm";
  headline: string;
  stats: {
    totalMessages: number;
    firstAt: string;
    lastAt: string;
    silenceDays: number;
    peakPerWeek: number;
    currentPerWeek: number;
    medianGapHours: number;
    /** Share of messages you sent, 0-1. */
    yourShare: number;
  };
  evidence: ExportedEvidence[];
};

export type ExportedCloseness = {
  thread: string;
  friend: string;
  isGroup: boolean;
  score: number;
  headline: string;
  factors: { key: string; label: string; score: number; detail: string }[];
  exhibit: { quote: string; sender: string; at: string } | null;
};

export type ExportedMoment = {
  kind: string;
  at: string;
  label: string;
  messages: { id: string; sender: string; text: string }[];
};

export type Insights = {
  schema: typeof SCHEMA;
  generatedAt: string;
  owner: string;
  source: "whatsapp" | "instagram" | "mixed";
  totals: {
    conversations: number;
    messages: number;
    dormant: number;
    /** Hours the archive's clock was shifted to put the sleep trough at night. */
    timezoneShiftHours: number;
  };
  /** Ranked by how worth rescuing each friendship is. */
  overdue: ExportedTie[];
  /** Ranked by how close the friendship actually is. */
  closest: ExportedCloseness[];
  /** Keyed by thread. Only present when `withRecaps` is set. */
  recaps?: Record<string, { moments: ExportedMoment[]; opened: ExportedMoment | null }>;
};

/* ------------------------------------------------------------------ */

const iso = (ts: number) => new Date(ts).toISOString();

function band(decay: number): ExportedTie["band"] {
  if (decay >= 0.45) return "dormant";
  if (decay >= 0.15) return "slipping";
  return "warm";
}

function exportMoment(m: {
  kind: string;
  ts: number;
  label: string;
  messages: { id: string; sender: string; text: string }[];
}): ExportedMoment {
  return {
    kind: m.kind,
    at: iso(m.ts),
    label: m.label,
    messages: m.messages,
  };
}

export function buildInsights(
  threads: Thread[],
  owner: string,
  opts: {
    source?: Insights["source"];
    withRecaps?: boolean;
    /** How many conversations to include. Four hundred is rarely what you want. */
    limit?: number;
    now?: number;
  } = {}
): Insights {
  const now = opts.now ?? Date.now();
  const limit = opts.limit ?? 25;

  const ties = analyse(threads, owner, now);
  const close = closeness(threads, owner, now);

  const allMessages = threads.flatMap((t) => t.messages);

  const insights: Insights = {
    schema: SCHEMA,
    generatedAt: new Date(now).toISOString(),
    owner,
    source: opts.source ?? "whatsapp",
    totals: {
      conversations: threads.length,
      messages: allMessages.length,
      dormant: ties.filter((t) => band(t.decay) === "dormant").length,
      timezoneShiftHours: inferHourShift(allMessages),
    },
    overdue: ties.slice(0, limit).map((t) => ({
      thread: t.thread,
      friend: t.friend,
      isGroup: t.isGroup,
      decay: t.decay,
      band: band(t.decay),
      headline: headline(t),
      stats: {
        totalMessages: t.totalMessages,
        firstAt: iso(t.firstTs),
        lastAt: iso(t.lastTs),
        silenceDays: t.silenceDays,
        peakPerWeek: t.peakPerWeek,
        currentPerWeek: t.currentPerWeek,
        medianGapHours: t.medianGapHours,
        yourShare: t.yourShare,
      },
      evidence: t.evidence.map((e) => ({
        kind: e.kind,
        messageId: e.messageId,
        at: iso(e.ts),
        sender: e.sender,
        quote: e.quote,
        reason: e.reason,
        confidence: Math.round(e.confidence * 1000) / 1000,
      })),
    })),
    closest: close.slice(0, limit).map((c) => ({
      thread: c.thread,
      friend: c.friend,
      isGroup: c.isGroup,
      score: c.score,
      headline: closenessHeadline(c),
      factors: c.factors.map((f) => ({
        key: f.key,
        label: f.label,
        score: Math.round(f.score * 1000) / 1000,
        detail: f.detail,
      })),
      exhibit: c.exhibit
        ? { quote: c.exhibit.text, sender: c.exhibit.sender, at: iso(c.exhibit.ts) }
        : null,
    })),
  };

  if (opts.withRecaps) {
    const recaps: NonNullable<Insights["recaps"]> = {};
    // Only for the conversations that made the ranking; a recap for all four
    // hundred is a lot of work nobody asked for.
    const wanted = new Set([
      ...insights.overdue.map((t) => t.thread),
      ...insights.closest.map((c) => c.thread),
    ]);

    for (const thread of threads) {
      if (!wanted.has(thread.name)) continue;
      const moments = highlights(thread.messages);
      if (!moments.length) continue;
      const ends = bookends(thread.messages);
      recaps[thread.name] = {
        moments: moments.map(exportMoment),
        opened: ends ? exportMoment(ends.first) : null,
      };
    }

    insights.recaps = recaps;
  }

  return insights;
}
