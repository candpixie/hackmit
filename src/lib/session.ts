/**
 * In-memory hold on the parsed archive for the length of a session.
 *
 * The recap needs the messages themselves, not just the signals derived from
 * them, and re-uploading a hundred thousand lines to draw one timeline is
 * absurd. So the parse is kept in the server process, keyed by session, and
 * evicted on a timer.
 *
 * The map is a cache, not the record. With Elasticsearch configured the
 * messages were indexed on the way in, so a session outlives a restart and is
 * read back rather than reparsed. Without it, a restart really does lose the
 * archive, which is the honest tradeoff of never persisting anything.
 */

import type { Thread } from "./parse";
import { elasticConfigured, rehydrate } from "./elastic";

const TTL = 60 * 60_000; // an hour is longer than anyone's sitting
const MAX_SESSIONS = 20;

type Entry = { threads: Thread[]; owner: string; touched: number };

const store = new Map<string, Entry>();

function evict() {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (now - entry.touched > TTL) store.delete(id);
  }
  // Under memory pressure the oldest go first.
  while (store.size > MAX_SESSIONS) {
    const oldest = [...store.entries()].sort((a, b) => a[1].touched - b[1].touched)[0];
    store.delete(oldest[0]);
  }
}

export function remember(session: string, threads: Thread[], owner: string): void {
  evict();
  store.set(session, { threads, owner, touched: Date.now() });
}

export function recall(session: string): Entry | null {
  const entry = store.get(session);
  if (!entry) return null;
  entry.touched = Date.now();
  return entry;
}

/**
 * The durable read. Memory first, then the search index, which survives a
 * restart because the messages were indexed on the way in.
 */
export async function recallDurable(session: string): Promise<Entry | null> {
  const cached = recall(session);
  if (cached) return cached;
  if (!elasticConfigured()) return null;

  try {
    const restored = await rehydrate(session);
    if (!restored) return null;
    remember(session, restored.threads, restored.owner);
    return recall(session);
  } catch {
    return null;
  }
}
