/**
 * Everything one Wrapped needs, in one call.
 *
 *   GET  /api/wrapped?session=<id>
 *   POST /api/wrapped { localDir }
 */

import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { inferOwner, type Thread, dedupeThreadNames } from "@/lib/parse";
import { parseInstagramHtml, threadNameFromFolder } from "@/lib/instagram";
import { analyse, headline } from "@/lib/signals";
import { wrappedStats } from "@/lib/wrapped";
import { recallDurable, remember } from "@/lib/session";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

async function readInstagramDir(dir: string): Promise<Thread[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const threads: Thread[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = join(dir, entry.name);
    const files = (await readdir(folder)).filter((f) => /^message_\d+\.html$/.test(f));
    if (!files.length) continue;
    const merged = (
      await Promise.all(files.sort().map((f) => readFile(join(folder, f), "utf8")))
    ).join("\n");
    const t = parseInstagramHtml(merged, threadNameFromFolder(entry.name));
    if (t.messages.length) threads.push(t);
  }
  return dedupeThreadNames(threads);
}

function build(threads: Thread[], owner: string, session: string) {
  const ties = analyse(threads, owner).map((t) => ({ ...t, headline: headline(t) }));
  const stats = wrappedStats(threads, owner);

  const dormant = ties.filter((t) => t.decay >= 0.45);

  // The guess: the real answer plus three plausible decoys, so picking is a
  // real choice rather than a formality.
  const answer = dormant[0] ?? ties[0];
  const decoys = ties
    .filter((t) => t.thread !== answer?.thread && t.totalMessages > 60)
    .slice(0, 3);

  return {
    session,
    owner,
    stats,
    counts: {
      unanswered: ties.reduce(
        (n, t) => n + t.evidence.filter((e) => e.kind === "open-loop").length,
        0
      ),
      neverHappened: ties.reduce(
        (n, t) => n + t.evidence.filter((e) => e.kind === "promise").length,
        0
      ),
      theyWanted: ties.reduce(
        (n, t) => n + t.evidence.filter((e) => e.kind === "want").length,
        0
      ),
      dormant: dormant.length,
    },
    ties: ties.slice(0, 12),
    pendingPlans: ties.flatMap((t) => t.evidence
      .filter((e) => e.kind === "promise")
      .map((e) => ({ friend: t.friend, quote: e.quote, id: e.messageId }))).slice(0, 3),
    guess: answer
      ? {
          answerThread: answer.thread,
          options: [answer, ...decoys]
            .map((t) => ({
              thread: t.thread,
              friend: t.friend,
              totalMessages: t.totalMessages,
              silenceDays: t.silenceDays,
            }))
            // Deterministic shuffle so the answer is not always first.
            .sort((a, b) => a.thread.localeCompare(b.thread)),
          reveal: {
            friend: answer.friend,
            headline: answer.headline,
            silenceDays: answer.silenceDays,
            totalMessages: answer.totalMessages,
            evidence: answer.evidence.slice(0, 3),
          },
        }
      : null,
    wants: ties
      .flatMap((t) =>
        t.evidence
          .filter((e) => e.kind === "want")
          .map((e) => ({ friend: t.friend, quote: e.quote, at: e.ts, id: e.messageId }))
      )
      .slice(0, 4),
  };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (params.get("sample") === "1") {
    const threads = await readInstagramDir(join(process.cwd(), "data", "corpus-instagram", "inbox"));
    return NextResponse.json(build(threads, inferOwner(threads), "sample"));
  }
  const session = params.get("session");
  if (!session) return NextResponse.json({ error: "No session." }, { status: 400 });

  const held = await recallDurable(session);
  if (!held) {
    return NextResponse.json({ error: "Session expired. Load again." }, { status: 410 });
  }
  return NextResponse.json(build(held.threads, held.owner, session));
}

export async function POST(req: Request) {
  const { localDir } = (await req.json()) as { localDir?: string };
  if (!localDir) return NextResponse.json({ error: "Supply localDir." }, { status: 400 });
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled outside development." }, { status: 403 });
  }

  const dir = localDir.startsWith("~") ? join(homedir(), localDir.slice(1)) : localDir;
  const threads = await readInstagramDir(dir);
  if (!threads.length) {
    return NextResponse.json({ error: "No conversations found." }, { status: 400 });
  }

  const owner = inferOwner(threads);
  const session = randomUUID();
  remember(session, threads, owner);
  return NextResponse.json(build(threads, owner, session));
}
