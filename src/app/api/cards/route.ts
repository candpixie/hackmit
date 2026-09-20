/**
 * Cards in the CARDS_CONTRACT.md shape, from a real export.
 *
 *   GET  /api/cards?session=<id>
 *   GET  /api/cards                  the synthetic Instagram corpus
 *   POST /api/cards { localDir }
 *
 * The frontend swaps its static import for this and nothing else changes.
 */

import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { inferOwner, type Thread } from "@/lib/parse";
import { parseInstagramHtml, threadNameFromFolder } from "@/lib/instagram";
import { buildCards } from "@/lib/build-cards";
import { recall } from "@/lib/session";

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

    const thread = parseInstagramHtml(merged, threadNameFromFolder(entry.name));
    if (thread.messages.length) threads.push(thread);
  }
  return threads;
}

export async function GET(req: Request) {
  const session = new URL(req.url).searchParams.get("session");

  // An already-analysed session costs nothing to re-read.
  if (session) {
    const held = recall(session);
    if (!held) {
      return NextResponse.json({ error: "Session expired." }, { status: 410 });
    }
    return NextResponse.json(buildCards(held.threads, held.owner));
  }

  // Otherwise the synthetic corpus, so this endpoint always returns something.
  const dir = join(process.cwd(), "data", "corpus-instagram", "inbox");
  const threads = await readInstagramDir(dir);
  if (!threads.length) {
    return NextResponse.json(
      { error: "No corpus found. Run `pnpm ig-corpus`." },
      { status: 404 }
    );
  }
  return NextResponse.json(buildCards(threads, inferOwner(threads)));
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

  return NextResponse.json(buildCards(threads, inferOwner(threads)));
}
