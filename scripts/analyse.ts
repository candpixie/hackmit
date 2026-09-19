/**
 * Runs the whole pipeline over a folder of WhatsApp exports and prints the
 * ranking. Proves the engine without needing the UI or any API key.
 *
 *   pnpm analyse                 # the synthetic corpus
 *   pnpm analyse ~/my-exports    # your own, never committed
 */

import { readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { inferOwner, parseChat, type Thread } from "../src/lib/parse.ts";
import { analyse, headline } from "../src/lib/signals.ts";

const dir = process.argv[2] ?? join(process.cwd(), "data", "corpus");

const threads: Thread[] = readdirSync(dir)
  .filter((f) => extname(f) === ".txt")
  .map((f) => {
    const name = basename(f, ".txt").replace(/^WhatsApp Chat with /, "");
    return parseChat(readFileSync(join(dir, f), "utf8"), name);
  })
  .filter((t) => t.messages.length > 0);

if (!threads.length) {
  console.error(`No .txt exports found in ${dir}`);
  process.exit(1);
}

const owner = inferOwner(threads);
const ties = analyse(threads, owner);

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

console.log(`\n${bold("Overdue")} ${dim(`— ${threads.length} threads, you are "${owner}"`)}\n`);

for (const tie of ties) {
  const bar = "█".repeat(Math.round(tie.decay * 24)).padEnd(24, "·");
  console.log(`${bar} ${bold(tie.friend)} ${dim(tie.decay.toFixed(3))}`);
  console.log(`  ${headline(tie)}`);
  console.log(
    dim(
      `  peak ${tie.peakPerWeek}/wk · now ${tie.currentPerWeek}/wk · ` +
        `${tie.totalMessages} msgs · you sent ${Math.round(tie.yourShare * 100)}%`
    )
  );

  for (const e of tie.evidence.slice(0, 4)) {
    console.log(`  ${dim("·")} [${e.kind}] ${e.reason}`);
    console.log(`    "${e.quote}"`);
  }
  console.log();
}
