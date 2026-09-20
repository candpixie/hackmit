import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { NextResponse } from "next/server";
import { inferOwner, parseChat, type Thread } from "@/lib/parse";
import { analyse, classify, headline } from "@/lib/signals";
import { closeness, closenessHeadline } from "@/lib/closeness";
import { elasticConfigured, indexMessages, type IndexedMessage } from "@/lib/elastic";
import { remember } from "@/lib/session";
import { parseInstagramHtml, threadNameFromFolder } from "@/lib/instagram";

export const runtime = "nodejs";

type Upload = { name: string; text: string };

function threadName(fileName: string): string {
  return basename(fileName, extname(fileName))
    .replace(/^WhatsApp Chat (with|-) /i, "")
    .replace(/^_chat$/i, "Chat")
    .trim();
}

/**
 * An Instagram export is a directory of four hundred folders, which is not
 * something anyone is going to select in a file picker. Reading it from disk
 * is a local convenience and is refused outside development.
 */
async function readInstagramDir(dir: string): Promise<Thread[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const threads: Thread[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const folder = join(dir, entry.name);
    const files = (await readdir(folder)).filter((f) => /^message_\d+\.html$/.test(f));
    if (!files.length) continue;

    // Long conversations are split across message_1, message_2, and so on.
    const merged = (
      await Promise.all(files.sort().map((f) => readFile(join(folder, f), "utf8")))
    ).join("\n");

    const thread = parseInstagramHtml(merged, threadNameFromFolder(entry.name));
    if (thread.messages.length) threads.push(thread);
  }

  return threads;
}

async function build(uploads: Upload[], preparsed?: Thread[]) {
  const threads: Thread[] =
    preparsed ??
    uploads
      .map((u) => parseChat(u.text, threadName(u.name)))
      .filter((t) => t.messages.length > 0);

  if (!threads.length) {
    return { error: "No messages found. Export as .txt without media." };
  }

  const owner = inferOwner(threads);
  const ties = analyse(threads, owner).map((t) => ({ ...t, headline: headline(t) }));

  const close = closeness(threads, owner).map((c) => ({
    ...c,
    headline: closenessHeadline(c),
  }));

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
    closest: close.slice(0, 25),
    search: { enabled: indexed > 0, indexed, error: indexError },
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as { files?: Upload[]; localDir?: string };
  const { files } = body;
  let { localDir } = body;

  if (localDir) {
    // A path typed by a human starts with ~ about half the time.
    localDir = localDir.startsWith("~")
      ? join(homedir(), localDir.slice(1))
      : localDir;

    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Reading local directories is disabled outside development." },
        { status: 403 }
      );
    }

    try {
      const info = await stat(localDir);
      if (!info.isDirectory()) throw new Error("Not a directory.");
    } catch {
      // A mistyped path is the most likely failure here, so say what we looked
      // for rather than only that it was not there.
      return NextResponse.json(
        {
          error: `Cannot read ${localDir}. Expected a folder of Instagram conversation directories, usually ~/Downloads/inbox.`,
        },
        { status: 400 }
      );
    }

    const threads = await readInstagramDir(localDir);
    if (!threads.length) {
      return NextResponse.json(
        { error: "No Instagram conversations found in that folder." },
        { status: 400 }
      );
    }

    const result = await build([], threads);
    return NextResponse.json({ ...result, source: "instagram" });
  }

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
