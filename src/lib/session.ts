/**
 * In-memory hold on the parsed archive for the length of a session.
 *
 * The recap needs the messages themselves, not just the signals derived from
 * them, and re-uploading a hundred thousand lines to draw one timeline is
 * absurd. So the parse is kept in the server process, keyed by session, and
 * evicted on a timer.
 *
 * Deliberately not a database. Restart the process and every archive is gone,
 * which is the property we promised on the landing page.
 */

import type { Thread } from "./parse";

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
