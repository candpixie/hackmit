/**
 * The whole analysis as one JSON document.
 *
 *   GET  /api/insights?session=<id>&recaps=1&limit=25
 *   GET  /api/insights                      the sample archive
 *   POST /api/insights  { localDir | files }
 *
 * Returned shape is `overdue.insights.v1`. See src/lib/export.ts.
 */

import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { homedir } from "node:os";
import { NextResponse } from "next/server";
import { inferOwner, parseChat, type Thread } from "@/lib/parse";
import { parseInstagramHtml, threadNameFromFolder } from "@/lib/instagram";
import { buildInsights } from "@/lib/export";
import { recall } from "@/lib/session";

export const runtime = "nodejs";

type Upload = { name: string; text: string };

function threadName(fileName: string): string {
  return basename(fileName, extname(fileName))
    .replace(/^WhatsApp Chat (with|-) /i, "")
    .replace(/^_chat$/i, "Chat")
    .trim();
}

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

function options(url: URL) {
  return {
    withRecaps: url.searchParams.get("recaps") === "1",
    limit: Number(url.searchParams.get("limit")) || 25,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = url.searchParams.get("session");

  // An already-analysed session is the cheap path: nothing is re-parsed.
  if (session) {
    const held = recall(session);
    if (!held) {
      return NextResponse.json(
        { error: "That session is no longer loaded. Analyse again." },
        { status: 410 }
      );
    }
    return NextResponse.json(
      buildInsights(held.threads, held.owner, { ...options(url), source: "mixed" })
    );
  }

  const dir = join(process.cwd(), "data", "corpus");
  const names = (await readdir(dir)).filter((f) => extname(f) === ".txt");
  const threads = (
    await Promise.all(
      names.map(async (name) =>
        parseChat(await readFile(join(dir, name), "utf8"), threadName(name))
      )
    )
  ).filter((t) => t.messages.length > 0);

  return NextResponse.json(
    buildInsights(threads, inferOwner(threads), { ...options(url), source: "whatsapp" })
  );
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json()) as { files?: Upload[]; localDir?: string };

  let threads: Thread[];
  let source: "whatsapp" | "instagram";

  if (body.localDir) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Reading local directories is disabled outside development." },
        { status: 403 }
      );
    }
    const dir = body.localDir.startsWith("~")
      ? join(homedir(), body.localDir.slice(1))
      : body.localDir;

    threads = await readInstagramDir(dir);
    source = "instagram";
  } else if (body.files?.length) {
    threads = body.files
      .map((f) => parseChat(f.text, threadName(f.name)))
      .filter((t) => t.messages.length > 0);
    source = "whatsapp";
  } else {
    return NextResponse.json({ error: "Supply files or localDir." }, { status: 400 });
  }

  if (!threads.length) {
    return NextResponse.json({ error: "No conversations found." }, { status: 400 });
  }

  return NextResponse.json(
    buildInsights(threads, inferOwner(threads), { ...options(url), source })
  );
}
