/**
 * Traces a claim back to the raw export.
 *
 *   pnpm verify <inbox> "<text from a quote>"
 *
 * Re-reads the original HTML independently of the engine and prints what is
 * actually in the file: who said it, when, and for a question, every message
 * you sent afterwards that could have been an answer. The point is that any
 * number this project puts on screen can be checked against the source in one
 * command.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseInstagramHtml, threadNameFromFolder } from "../src/lib/instagram.ts";
import { inferOwner, type Thread } from "../src/lib/parse.ts";

const root = process.argv[2];
const needle = process.argv[3];

if (!root || !needle) {
  console.error('usage: pnpm verify <inbox> "<text from a quote>"');
  process.exit(1);
}

const threads: Thread[] = [];
for (const f of readdirSync(root)) {
  try {
    if (!statSync(join(root, f)).isDirectory()) continue;
  } catch {
    continue;
  }
  const files = readdirSync(join(root, f)).filter((x) => /^message_\d+\.html$/.test(x));
  if (!files.length) continue;
  const merged = files
    .sort()
    .map((x) => readFileSync(join(root, f, x), "utf8"))
    .join("\n");
  const t = parseInstagramHtml(merged, threadNameFromFolder(f));
  if (t.messages.length) threads.push(t);
}

const owner = inferOwner(threads);

const STOP = new Set(
  "the a an and or but if then than that this these those i you he she it we they me him her us them my your his its our their is are was were be been being do does did done have has had will would can could should shall may might must not no yes so just really very much more most some any all about with from into for of on in at to up out off over under again too also still even ever never now then there here what when where who why how which about going get got go went come came know knew think thought want wanted like liked make made take took see saw say said tell told one two lol lmao omg ok okay yeah yea nah hey hi bye thanks thank please sorry".split(
    " "
  )
);

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w))
  );

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

let found = 0;

for (const thread of threads) {
  const ms = [...thread.messages].sort((a, b) => a.ts - b.ts);

  for (let i = 0; i < ms.length; i++) {
    if (!ms[i].text.toLowerCase().includes(needle.toLowerCase())) continue;
    found++;

    const m = ms[i];
    const days = Math.round((Date.now() - m.ts) / 86_400_000);

    console.log(`\n${bold(thread.name)}  ${dim(`message ${m.id}`)}`);
    console.log(`  ${bold(m.sender)} · ${new Date(m.ts).toLocaleString()} · ${days} days ago`);
    console.log(`  "${m.text.slice(0, 160)}"`);

    if (m.sender === owner) {
      console.log(dim("  (you sent this)"));
      continue;
    }

    const asked = words(m.text);
    console.log(dim(`  content words: ${[...asked].join(", ") || "(none)"}`));

    let spoke = 0;
    let answer: (typeof ms)[number] | null = null;

    for (let j = i + 1; j < ms.length && ms[j].ts - m.ts <= 14 * 86_400_000; j++) {
      if (ms[j].sender !== owner) continue;
      spoke++;
      const reply = words(ms[j].text);
      for (const w of asked) {
        if (reply.has(w)) {
          answer = ms[j];
          break;
        }
      }
      if (answer) break;
    }

    // Two different failures, and only one of them is the interesting one.
    if (answer) {
      console.log(`  you sent ${spoke} messages in the 14 days after this`);
      console.log(`  \x1b[32mANSWERED\x1b[0m by "${answer.text.slice(0, 80)}"`);
    } else if (spoke === 0) {
      console.log(`  \x1b[31mNEVER REPLIED\x1b[0m — you did not send anything for 14 days after this`);
    } else {
      console.log(`  you sent ${spoke} messages in the 14 days after this`);
      console.log(
        `  \x1b[31mNEVER ANSWERED\x1b[0m — not one of those ${spoke} contained any of: ${[...asked].join(", ")}`
      );
    }
  }
}

console.log(
  `\n${dim(`${found} match${found === 1 ? "" : "es"} across ${threads.length} conversations, read as "${owner}"`)}\n`
);
