/**
 * Writes the whole analysis to a JSON file, no server required.
 *
 *   pnpm insights <dir> [out.json]
 *
 * <dir> is either a folder of WhatsApp .txt exports, or an Instagram inbox
 * folder. Which one is detected from what is inside it.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { inferOwner, parseChat, type Thread } from "../src/lib/parse.ts";
import { parseInstagramHtml, threadNameFromFolder } from "../src/lib/instagram.ts";
import { buildInsights } from "../src/lib/export.ts";

const dir = process.argv[2];
const out = process.argv[3] ?? "insights.json";

if (!dir) {
  console.error("usage: pnpm insights <dir> [out.json]");
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

const owner = inferOwner(threads);
const insights = buildInsights(threads, owner, {
  source: isInstagram ? "instagram" : "whatsapp",
  withRecaps: true,
  limit: Number(process.env.LIMIT) || 25,
});

writeFileSync(out, JSON.stringify(insights, null, 2), "utf8");

console.log(`
  ${insights.schema}
  owner            ${insights.owner}
  conversations    ${insights.totals.conversations}
  messages         ${insights.totals.messages.toLocaleString()}
  dormant          ${insights.totals.dormant}
  timezone shift   ${insights.totals.timezoneShiftHours}h
  overdue          ${insights.overdue.length}
  closest          ${insights.closest.length}
  recaps           ${Object.keys(insights.recaps ?? {}).length}

  -> ${out}
`);
