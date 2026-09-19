import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { NextResponse } from "next/server";
import { inferOwner, parseChat, type Thread } from "@/lib/parse";
import { analyse, headline } from "@/lib/signals";

export const runtime = "nodejs";

type Upload = { name: string; text: string };

function threadName(fileName: string): string {
  return basename(fileName, extname(fileName))
    .replace(/^WhatsApp Chat with /i, "")
    .replace(/^_chat$/i, "Chat")
    .trim();
}

function build(uploads: Upload[]) {
  const threads: Thread[] = uploads
    .map((u) => parseChat(u.text, threadName(u.name)))
    .filter((t) => t.messages.length > 0);

  if (!threads.length) {
    return { error: "No messages found. Export as .txt without media." };
  }

  const owner = inferOwner(threads);
  const ties = analyse(threads, owner).map((t) => ({ ...t, headline: headline(t) }));

  return {
    owner,
    threadCount: threads.length,
    messageCount: threads.reduce((n, t) => n + t.messages.length, 0),
    ties,
  };
}

export async function POST(req: Request) {
  const { files } = (await req.json()) as { files?: Upload[] };

  if (!files?.length) {
    return NextResponse.json({ error: "No files supplied." }, { status: 400 });
  }

  const result = build(files);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}

/** The synthetic corpus, so the demo runs with nothing uploaded. */
export async function GET() {
  const dir = join(process.cwd(), "data", "corpus");
  const names = (await readdir(dir)).filter((f) => extname(f) === ".txt");

  const uploads = await Promise.all(
    names.map(async (name) => ({ name, text: await readFile(join(dir, name), "utf8") }))
  );

  return NextResponse.json({ ...build(uploads), sample: true });
}
