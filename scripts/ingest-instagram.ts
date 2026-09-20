/**
 * Reads an Instagram "inbox" export directory and runs the whole pipeline.
 *
 *   pnpm ig ~/Downloads/inbox
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseInstagramHtml, threadNameFromFolder } from "../src/lib/instagram.ts";
import { inferOwner } from "../src/lib/parse.ts";
import { analyse, headline } from "../src/lib/signals.ts";
import type { Thread } from "../src/lib/parse.ts";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: pnpm ig <path to inbox>");
  process.exit(1);
}

const folders = readdirSync(dir).filter((f) => {
  try {
    return statSync(join(dir, f)).isDirectory();
  } catch {
    return false;
  }
});

const threads: Thread[] = [];
for (const folder of folders) {
  const files = readdirSync(join(dir, folder)).filter((f) => /^message_\d+\.html$/.test(f));
  if (!files.length) continue;

  // A long conversation is split across message_1, message_2, …
  const merged = files
    .sort()
    .map((f) => readFileSync(join(dir, folder, f), "utf8"))
    .join("\n");

  const t = parseInstagramHtml(merged, threadNameFromFolder(folder));
  if (t.messages.length) threads.push(t);
}

if (!threads.length) {
  console.error(`No conversations parsed from ${dir}`);
  process.exit(1);
}

const owner = inferOwner(threads);
const total = threads.reduce((n, t) => n + t.messages.length, 0);
const ties = analyse(threads, owner);

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

console.log(
  `\n${bold("Overdue")} ${dim(
    `— ${threads.length} conversations, ${total.toLocaleString()} messages, you are "${owner}"`
  )}\n`
);

for (const tie of ties.slice(0, Number(process.argv[3] ?? 8))) {
  const bar = "█".repeat(Math.round(tie.decay * 24)).padEnd(24, "·");
  console.log(`${bar} ${bold(tie.friend)} ${dim(tie.decay.toFixed(3))}`);
  console.log(`  ${headline(tie)}`);
  console.log(
    dim(`  peak ${tie.peakPerWeek}/wk · ${tie.totalMessages} msgs · you sent ${Math.round(tie.yourShare * 100)}%`)
  );
  for (const e of tie.evidence.slice(0, 3)) {
    console.log(`  ${dim("·")} [${e.kind}] ${e.reason}`);
    console.log(`    "${e.quote}"`);
  }
  console.log();
}
