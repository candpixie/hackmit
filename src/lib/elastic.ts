/**
 * Elasticsearch layer.
 *
 * One person's archive is small enough to scan in a loop, which is how the
 * engine started. A real archive is not: ten years of fifty threads is
 * hundreds of thousands of messages, and the questions we want to ask of it
 * are search questions, not iteration questions.
 *
 *   - candidate retrieval   find every unanswered-looking question across
 *                           every thread at once, ranked, without loading the
 *                           corpus into memory
 *   - cadence aggregation   a date histogram per thread, which is a bucket
 *                           count rather than a pass over every message
 *   - cross-thread search   "who has mentioned wanting pottery" spans people,
 *                           which is what the group planner needs and what no
 *                           per-thread loop can answer
 *
 * Every function degrades to null when Elasticsearch is not configured, so the
 * app runs with no cluster at all and simply loses the cross-thread features.
 */

import type { Message } from "./parse";

const URL_ = process.env.ELASTIC_URL;
const KEY = process.env.ELASTIC_API_KEY;

export const INDEX = "overdue-messages";

export function elasticConfigured(): boolean {
  return Boolean(URL_ && KEY);
}

async function es(path: string, init?: RequestInit): Promise<any> {
  if (!URL_ || !KEY) throw new Error("Elasticsearch is not configured.");

  const res = await fetch(`${URL_.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `ApiKey ${KEY}`,
      ...init?.headers,
    },
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Elasticsearch ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return body ? JSON.parse(body) : null;
}

/* ------------------------------------------------------------------ */
/* mapping                                                             */
/* ------------------------------------------------------------------ */

const MAPPING = {
  mappings: {
    properties: {
      session: { type: "keyword" },
      msgId: { type: "keyword" },
      thread: { type: "keyword" },
      sender: { type: "keyword" },
      isOwner: { type: "boolean" },
      ts: { type: "date" },
      text: {
        type: "text",
        // English analysis so "wanted" matches "wanting", which is what the
        // want and promise patterns are really reaching for.
        analyzer: "english",
        fields: { raw: { type: "keyword", ignore_above: 512 } },
      },
      isQuestion: { type: "boolean" },
      hasCommitment: { type: "boolean" },
      hasActivity: { type: "boolean" },
      wordCount: { type: "integer" },
    },
  },
} as const;

export async function ensureIndex(): Promise<void> {
  const exists = await fetch(`${URL_!.replace(/\/$/, "")}/${INDEX}`, {
    method: "HEAD",
    headers: { authorization: `ApiKey ${KEY!}` },
  });
  if (exists.status === 200) return;
  await es(`/${INDEX}`, { method: "PUT", body: JSON.stringify(MAPPING) });
}

/* ------------------------------------------------------------------ */
/* indexing                                                            */
/* ------------------------------------------------------------------ */

export type IndexedMessage = Message & {
  isOwner: boolean;
  isQuestion: boolean;
  hasCommitment: boolean;
  hasActivity: boolean;
};

/**
 * Bulk index one session's messages. The session id scopes every later query,
 * so two people using the same cluster never see each other's archives.
 */
export async function indexMessages(
  session: string,
  messages: IndexedMessage[]
): Promise<number> {
  await ensureIndex();

  let indexed = 0;

  // Elasticsearch's bulk body is newline delimited, two lines per document.
  for (let i = 0; i < messages.length; i += 2000) {
    const slice = messages.slice(i, i + 2000);
    const body =
      slice
        .flatMap((m) => [
          JSON.stringify({ index: { _index: INDEX, _id: `${session}:${m.id}` } }),
          JSON.stringify({
            session,
            msgId: m.id,
            thread: m.thread,
            sender: m.sender,
            isOwner: m.isOwner,
            ts: new Date(m.ts).toISOString(),
            text: m.text,
            isQuestion: m.isQuestion,
            hasCommitment: m.hasCommitment,
            hasActivity: m.hasActivity,
            wordCount: m.text.split(/\s+/).length,
          }),
        ])
        .join("\n") + "\n";

    const res = await es(`/_bulk?refresh=${i + 2000 >= messages.length}`, {
      method: "POST",
      headers: { "content-type": "application/x-ndjson" },
      body,
    });

    if (res.errors) {
      const first = res.items?.find((it: any) => it.index?.error)?.index?.error;
      throw new Error(`Bulk index failed: ${first?.reason ?? "unknown"}`);
    }
    indexed += slice.length;
  }

  return indexed;
}

export async function dropSession(session: string): Promise<void> {
  await es(`/${INDEX}/_delete_by_query?refresh=true`, {
    method: "POST",
    body: JSON.stringify({ query: { term: { session } } }),
  });
}

/* ------------------------------------------------------------------ */
/* queries                                                             */
/* ------------------------------------------------------------------ */

export type Hit = {
  msgId: string;
  thread: string;
  sender: string;
  ts: number;
  text: string;
  score: number;
};

function toHits(res: any): Hit[] {
  return (res.hits?.hits ?? []).map((h: any) => ({
    msgId: h._source.msgId,
    thread: h._source.thread,
    sender: h._source.sender,
    ts: new Date(h._source.ts).getTime(),
    text: h._source.text,
    score: h._score ?? 0,
  }));
}

/**
 * Free-text search across every thread at once. This is the query the group
 * planner runs: "who has ever mentioned wanting pottery" is a question about
 * five people's archives simultaneously, which is not a shape a per-thread
 * scan can answer.
 */
export async function searchAll(
  session: string,
  query: string,
  opts: { size?: number; excludeOwner?: boolean } = {}
): Promise<Hit[]> {
  const filter: any[] = [{ term: { session } }];
  if (opts.excludeOwner) filter.push({ term: { isOwner: false } });

  const res = await es(`/${INDEX}/_search`, {
    method: "POST",
    body: JSON.stringify({
      size: opts.size ?? 20,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ["text^2"],
                fuzziness: "AUTO",
                operator: "or",
              },
            },
          ],
          filter,
          // Longer messages carry more of a real thought than one-word chatter.
          should: [{ range: { wordCount: { gte: 8, boost: 1.4 } } }],
        },
      },
    }),
  });

  return toHits(res);
}

/**
 * Candidate unanswered questions across the corpus, newest first within each
 * thread. Elasticsearch does the recall; the engine still decides which of
 * these were actually left hanging, because that needs the messages that came
 * after each one.
 */
export async function questionCandidates(
  session: string,
  size = 400
): Promise<Hit[]> {
  const res = await es(`/${INDEX}/_search`, {
    method: "POST",
    body: JSON.stringify({
      size,
      query: {
        bool: {
          filter: [
            { term: { session } },
            { term: { isQuestion: true } },
            { term: { isOwner: false } },
            { range: { wordCount: { gte: 5 } } },
          ],
        },
      },
      sort: [{ ts: "desc" }],
    }),
  });

  return toHits(res);
}

/** Commitments that name something you would actually do together. */
export async function promiseCandidates(session: string, size = 200): Promise<Hit[]> {
  const res = await es(`/${INDEX}/_search`, {
    method: "POST",
    body: JSON.stringify({
      size,
      query: {
        bool: {
          filter: [
            { term: { session } },
            { term: { hasCommitment: true } },
            { term: { hasActivity: true } },
          ],
        },
      },
      sort: [{ ts: "desc" }],
    }),
  });

  return toHits(res);
}

/* ------------------------------------------------------------------ */
/* aggregations                                                        */
/* ------------------------------------------------------------------ */

export type CadencePoint = { ts: number; count: number };

/**
 * Monthly message counts per thread, as a date histogram. This is the shape of
 * a friendship over time, and it is a bucket count rather than a pass over
 * every message, which is the whole reason it belongs in Elasticsearch.
 */
export async function cadence(
  session: string,
  thread?: string
): Promise<Record<string, CadencePoint[]>> {
  const filter: any[] = [{ term: { session } }];
  if (thread) filter.push({ term: { thread } });

  const res = await es(`/${INDEX}/_search`, {
    method: "POST",
    body: JSON.stringify({
      size: 0,
      query: { bool: { filter } },
      aggs: {
        threads: {
          terms: { field: "thread", size: 100 },
          aggs: {
            months: {
              date_histogram: {
                field: "ts",
                calendar_interval: "month",
                min_doc_count: 0,
              },
            },
          },
        },
      },
    }),
  });

  const out: Record<string, CadencePoint[]> = {};
  for (const bucket of res.aggregations?.threads?.buckets ?? []) {
    out[bucket.key] = (bucket.months?.buckets ?? []).map((b: any) => ({
      ts: b.key,
      count: b.doc_count,
    }));
  }
  return out;
}
