/**
 * Serves the DM-style frontend.
 *
 * It is a single hand-written HTML page rather than a React component, so it
 * is returned as-is instead of being ported. Next will not serve a directory
 * index out of public/, hence the route.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const html = await readFile(join(process.cwd(), "frontend", "index.html"), "utf8");

  // /dm?sample=1 ignores whatever archive is loaded and reads the corpus.
  // A stale session survives in the search index, so "load the sample again"
  // is not always enough to escape one, and a demo needs a URL that is.
  const sample = new URL(req.url).searchParams.has("sample");

  // It was written against a Python server that exposed /cards. Point it at
  // this app's endpoint and at whatever archive the other surfaces loaded.
  const patched = html.replace(
    "fetch('/cards', { cache: 'no-store' })",
    sample
      ? `fetch('/api/cards', { cache: 'no-store' })`
      : `fetch((() => {
      try {
        const s = localStorage.getItem('overdue.session');
        return s ? '/api/cards?session=' + encodeURIComponent(s) : '/api/cards';
      } catch { return '/api/cards'; }
    })(), { cache: 'no-store' })`
  );

  return new Response(patched, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
