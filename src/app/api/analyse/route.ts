import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { NextResponse } from "next/server";
import { inferOwner, parseChat, type Thread } from "@/lib/parse";
import { analyse, classify, headline } from "@/lib/signals";
import { elasticConfigured, indexMessages, type IndexedMessage } from "@/lib/elastic";
import { remember } from "@/lib/session";

export const runtime = "nodejs";

type Upload = { name: string; text: string };

function threadName(fileName: string): string {
  return basename(fileName, extname(fileName))
    .replace(/^WhatsApp Chat (with|-) /i, "")
    .replace(/^_chat$/i, "Chat")
    .trim();
}

async function build(uploads: Upload[]) {
  const threads: Thread[] = uploads
    .map((u) => parseChat(u.text, threadName(u.name)))
    .filter((t) => t.messages.length > 0);

  if (!threads.length) {
    return { error: "No messages found. Export as .txt without media." };
  }

  const owner = inferOwner(threads);
  const ties = analyse(threads, owner).map((t) => ({ ...t, headline: headline(t) }));

  const session = randomUUID();

  // The recap needs the messages themselves, not just what we derived from them.
  remember(session, threads, owner);

  // Indexing is what makes cross-thread search possible, but the ranking above
  // does not depend on it, so a cluster that is down or absent costs us the
  // group planner and nothing else.
  let indexed = 0;
  let indexError: string | null = null;

  if (elasticConfigured()) {
    try {
      const docs: IndexedMessage[] = threads.flatMap((t) =>
        t.messages.map((m) => ({
          ...m,
          isOwner: m.sender === owner,
          ...classify(m.text),
        }))
      );
      indexed = await indexMessages(session, docs);
    } catch (e) {
      indexError = e instanceof Error ? e.message : "Indexing failed.";
    }
  }

  return {
    session,
    owner,
    threadCount: threads.length,
    messageCount: threads.reduce((n, t) => n + t.messages.length, 0),
    ties,
    search: { enabled: indexed > 0, indexed, error: indexError },
  };
}

export async function POST(req: Request) {
  const { files } = (await req.json()) as { files?: Upload[] };

  if (!files?.length) {
    return NextResponse.json({ error: "No files supplied." }, { status: 400 });
  }

  const result = await build(files);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}

/** The synthetic corpus, so the demo runs with nothing uploaded. */
export async function GET() {
  const dir = join(process.cwd(), "data", "corpus");
  const names = (await readdir(dir)).filter((f) => extname(f) === ".txt");

  const uploads = await Promise.all(
    names.map(async (name) => ({ name, text: await readFile(join(dir, name), "utf8") }))
  );

  return NextResponse.json({ ...(await build(uploads)), sample: true });
}
