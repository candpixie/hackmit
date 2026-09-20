/**
 * Search, with or without a cluster.
 *
 * Elasticsearch is the real backend: it is what makes this work on an archive
 * too big to hold, and it is what the group planner is built against. But a
 * demo that dies because a cluster is unreachable is a bad demo, so the same
 * interface is implemented in memory over the session's parsed threads.
 *
 * The in-memory version is a small BM25: the same ranking idea, over the few
 * thousand messages one person actually uploaded. It is not a replacement, it
 * is a floor.
 */

import { searchAll as esSearch, elasticConfigured, type Hit } from "./elastic";
import { recall } from "./session";
import type { Message } from "./parse";

export type { Hit };

const STOP = new Set(
  "the a an and or but if then that this these those i you he she it we they me him her us them my your our their is are was were be been being do does did have has had will would can could should not no yes so just really very much more most some any all about with from into for of on in at to up out off over under again too also still even ever never now there here what when where who why how which get got go went come came know think want like make take see say tell one two".split(
    " "
  )
);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

/* ------------------------------------------------------------------ */

type Doc = { hit: Hit; tokens: string[] };

function corpusFor(session: string, excludeOwner: boolean): Doc[] | null {
  const held = recall(session);
  if (!held) return null;

  const docs: Doc[] = [];
  for (const thread of held.threads) {
    for (const m of thread.messages) {
      if (excludeOwner && m.sender === held.owner) continue;
      docs.push({
        hit: {
          msgId: m.id,
          thread: thread.name,
          sender: m.sender,
          ts: m.ts,
          text: m.text,
          score: 0,
        },
        tokens: tokenise(m.text),
      });
    }
  }
  return docs;
}

/**
 * BM25 over the session's own messages. Same shape of answer Elasticsearch
 * gives, computed on the spot, so every feature above this line works whether
 * or not a cluster is configured.
 */
function bm25(docs: Doc[], query: string, size: number): Hit[] {
  const terms = tokenise(query);
  if (!terms.length) return [];

  const N = docs.length;
  const avgLen = docs.reduce((n, d) => n + d.tokens.length, 0) / Math.max(N, 1);
  const k1 = 1.4;
  const b = 0.75;

  const df = new Map<string, number>();
  for (const term of new Set(terms)) {
    let n = 0;
    for (const d of docs) if (d.tokens.includes(term)) n++;
    df.set(term, n);
  }

  const scored: Hit[] = [];

  for (const d of docs) {
    let score = 0;

    for (const term of terms) {
      const n = df.get(term) ?? 0;
      if (n === 0) continue;

      let tf = 0;
      for (const t of d.tokens) if (t === term) tf++;
      if (tf === 0) continue;

      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const norm = tf * (k1 + 1);
      const denom = tf + k1 * (1 - b + (b * d.tokens.length) / avgLen);
      score += idf * (norm / denom);
    }

    if (score <= 0) continue;

    // A longer message carries more of a real thought than a one-word reply,
    // which matters when we are looking for what somebody wanted.
    if (d.tokens.length >= 8) score *= 1.4;

    scored.push({ ...d.hit, score });
  }

  return scored.sort((a, b2) => b2.score - a.score).slice(0, size);
}

/* ------------------------------------------------------------------ */

export type Backend = "elasticsearch" | "in-memory";

export type SearchResult = { hits: Hit[]; backend: Backend };

/**
 * Prefers Elasticsearch, falls back to memory. The caller is told which ran,
 * because a demo should say what it is actually doing.
 */
export async function search(
  session: string,
  query: string,
  opts: { size?: number; excludeOwner?: boolean; threads?: string[] } = {}
): Promise<SearchResult> {
  const size = opts.size ?? 20;

  if (elasticConfigured()) {
    try {
      const hits = await esSearch(session, query, opts);
      if (hits.length) return { hits, backend: "elasticsearch" };
    } catch {
      // Fall through. An unreachable cluster should cost us scale, not the demo.
    }
  }

  const all = corpusFor(session, opts.excludeOwner ?? false);
  if (!all) return { hits: [], backend: "in-memory" };

  const docs = opts.threads?.length
    ? all.filter((d) => opts.threads!.includes(d.hit.thread))
    : all;

  return { hits: bm25(docs, query, size), backend: "in-memory" };
}
