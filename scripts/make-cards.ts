/**
 * Writes cards.json in the CARDS_CONTRACT.md shape from a real export.
 *
 *   pnpm cards <dir> [out.json]
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { dedupeThreadNames, inferOwner, parseChat, type Thread } from "../src/lib/parse.ts";
import { parseInstagramHtml, threadNameFromFolder } from "../src/lib/instagram.ts";
import { buildCards } from "../src/lib/build-cards.ts";

const dir = process.argv[2];
const out = process.argv[3] ?? "cards.json";
if (!dir) {
  console.error("usage: pnpm cards <dir> [out.json]");
  process.exit(1);
}

const entries = readdirSync(dir);
const isInstagram = entries.some((e) => {
  try {
    return (
      statSync(join(dir, e)).isDirectory() &&
      readdirSync(join(dir, e)).some((f) => /^message_\d+\.html$/.test(f))
    );
  } catch {
    return false;
  }
});

const threads: Thread[] = [];
if (isInstagram) {
  for (const folder of entries) {
    try {
      if (!statSync(join(dir, folder)).isDirectory()) continue;
    } catch {
      continue;
    }
    const files = readdirSync(join(dir, folder)).filter((f) =>
      /^message_\d+\.html$/.test(f)
    );
    if (!files.length) continue;
    const merged = files
      .sort()
      .map((f) => readFileSync(join(dir, folder, f), "utf8"))
      .join("\n");
    const t = parseInstagramHtml(merged, threadNameFromFolder(folder));
    if (t.messages.length) threads.push(t);
  }
} else {
  for (const f of entries.filter((e) => extname(e) === ".txt")) {
    const name = basename(f, ".txt").replace(/^WhatsApp Chat (with|-) /i, "");
    const t = parseChat(readFileSync(join(dir, f), "utf8"), name);
    if (t.messages.length) threads.push(t);
  }
}

if (!threads.length) {
  console.error(`No conversations found in ${dir}`);
  process.exit(1);
}

const deduped = dedupeThreadNames(threads);
const envelope = buildCards(deduped, inferOwner(deduped));
writeFileSync(out, JSON.stringify(envelope, null, 2), "utf8");

const byKind = new Map<string, number>();
for (const c of envelope.cards) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);

console.log(`\n  owner  ${envelope.owner}`);
console.log(`  cards  ${envelope.cards.length}\n`);
for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${kind.padEnd(18)} ${n}`);
}
console.log(`\n  -> ${out}\n`);
