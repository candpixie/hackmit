/**
 * Generates a synthetic WhatsApp export corpus in the real export format.
 *
 * This exists so the repo, the tests and the deployed demo never contain a
 * real person's messages. Fully deterministic: same seed, same corpus.
 *
 *   pnpm corpus
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OWNER = "Sam";
const OUT = join(process.cwd(), "data", "corpus");

// Anchor the corpus so the demo reads the same on any day.
const NOW = new Date("2026-09-19T12:00:00").getTime();
const DAY = 86_400_000;

let seed = 20260919;
function rand(): number {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pick<T>(xs: T[]): T {
  return xs[Math.floor(rand() * xs.length)];
}

type Line = { ts: number; sender: string; text: string };

/** iOS export format, which is what most people hand us. */
function format(lines: Line[]): string {
  const header = `[${stamp(lines[0].ts - DAY)}] ${OWNER}: ‎Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.`;
  const body = lines
    .sort((a, b) => a.ts - b.ts)
    .map((l) => `[${stamp(l.ts)}] ${l.sender}: ${l.text}`)
    .join("\n");
  return header + "\n" + body + "\n";
}

function stamp(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}, ${h}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())} ${ampm}`;
}

const CHATTER = [
  "lmaooo", "ok but same", "wait what", "no way", "stopppp", "i'm crying",
  "did you see that", "send it", "omg", "yeah", "fr", "that's so real",
  "i'm dying", "ok wait", "hold on", "coming", "on my way", "5 min",
  "what time", "sounds good", "bet", "no thoughts", "literally me",
  "i can't", "ok deal", "let me check", "maybe", "idk", "we'll see",
  "good morning", "goodnight", "study group later?", "i failed that",
  "i'm so tired", "same tbh", "one more week", "almost done",
];

/**
 * Lays down background chatter at a given intensity, leaving the hand-written
 * beats to carry the actual meaning.
 */
function chatter(
  from: number,
  to: number,
  perWeek: number,
  senders: string[],
  lines: Line[]
) {
  const weeks = (to - from) / (7 * DAY);
  const n = Math.max(0, Math.round(weeks * perWeek));
  for (let i = 0; i < n; i++) {
    const ts =
      from +
      rand() * (to - from) +
      // cluster into evenings
      0;
    const d = new Date(ts);
    d.setHours(16 + Math.floor(rand() * 7), Math.floor(rand() * 60), Math.floor(rand() * 60));
    lines.push({ ts: d.getTime(), sender: pick(senders), text: pick(CHATTER) });
  }
}

function ago(days: number, hour = 21): number {
  const d = new Date(NOW - days * DAY);
  d.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60));
  return d.getTime();
}

/* ------------------------------------------------------------------ */

const threads: { file: string; lines: Line[] }[] = [];

/* ---- 1. Maya: the flagship dormant tie -------------------------------
   Daily through senior year, tapers after graduation, ends on a question
   Sam never answered. Carries a promise and a want.                     */
{
  const M = "Maya Chen";
  const l: Line[] = [];
  chatter(ago(900), ago(500), 22, [OWNER, M], l);
  chatter(ago(500), ago(400), 9, [OWNER, M], l);
  chatter(ago(400), ago(330), 3, [OWNER, M], l);

  l.push(
    { ts: ago(870), sender: M, text: "i've always wanted to try pottery, there's a studio near the school that does walk-ins" },
    { ts: ago(869), sender: OWNER, text: "we should go after finals" },
    { ts: ago(869, 22), sender: M, text: "YES ok holding you to that" },
    { ts: ago(612), sender: M, text: "my apartment is overflowing with stuff, i genuinely own nothing i need" },
    { ts: ago(505), sender: M, text: "i'm moving to Seattle in august btw, got the job" },
    { ts: ago(504), sender: OWNER, text: "WHAT congrats!! we have to celebrate before you go" },
    { ts: ago(503), sender: M, text: "next time you're home let's do the pottery thing finally" },
    { ts: ago(430), sender: M, text: "ok i'm officially here. it's so grey lol" },
    { ts: ago(398), sender: M, text: "how did the interview go?? you never told me" },
    { ts: ago(341), sender: M, text: "are you around this weekend? i'm back east for my sister's thing" },
    { ts: ago(312), sender: M, text: "hey! no pressure at all, just realised it's been a while. hope you're ok" }
  );
  threads.push({ file: `WhatsApp Chat with ${M}.txt`, lines: l });
}

/* ---- 2. Dev: still warm, should NOT rank high ------------------------ */
{
  const D = "Dev Raman";
  const l: Line[] = [];
  chatter(ago(900), ago(4), 11, [OWNER, D], l);
  l.push(
    { ts: ago(200), sender: D, text: "i've been meaning to get a proper espresso setup, the office one is criminal" },
    { ts: ago(12), sender: D, text: "you free thursday? new ramen place opened" },
    { ts: ago(11), sender: OWNER, text: "yes finally. 7?" },
    { ts: ago(4), sender: D, text: "that was so good, same time next month" }
  );
  threads.push({ file: `WhatsApp Chat with ${D}.txt`, lines: l });
}

/* ---- 3. Priya: the one who carried it -------------------------------
   She sent most of the messages. Sam let it go quiet.                   */
{
  const P = "Priya Nair";
  const l: Line[] = [];
  chatter(ago(880), ago(520), 14, [P, P, P, OWNER], l);
  chatter(ago(520), ago(260), 4, [P, P, OWNER], l);

  l.push(
    { ts: ago(700), sender: P, text: "i'm dying to see that exhibition before it closes, nobody will come with me" },
    { ts: ago(455), sender: P, text: "we should do a proper trip, like actually book something instead of talking about it" },
    { ts: ago(288), sender: P, text: "did you end up moving? i saw the photos but i wasn't sure" },
    { ts: ago(260), sender: P, text: "ok i'll stop spamming you 😅 miss you though" }
  );
  threads.push({ file: `WhatsApp Chat with ${P}.txt`, lines: l });
}

/* ---- 4. Theo: brief but intense, then nothing ------------------------ */
{
  const T = "Theo Okafor";
  const l: Line[] = [];
  chatter(ago(760), ago(690), 30, [OWNER, T], l);
  l.push(
    { ts: ago(755), sender: T, text: "i've always wanted to learn to actually cook, not just survive" },
    { ts: ago(700), sender: T, text: "when you're back in town we're doing the whole day, market then cooking then the bad movie" },
    { ts: ago(691), sender: T, text: "how's the new place treating you" }
  );
  threads.push({ file: `WhatsApp Chat with ${T}.txt`, lines: l });
}

/* ---- 5. The group chat: the Friendsgiving target -------------------- */
{
  const l: Line[] = [];
  const people = [OWNER, "Maya Chen", "Priya Nair", "Theo Okafor", "Dev Raman"];
  chatter(ago(900), ago(520), 26, people, l);
  chatter(ago(520), ago(300), 5, people, l);

  l.push(
    { ts: ago(640), sender: "Theo Okafor", text: "we should all do a friendsgiving before everyone scatters" },
    { ts: ago(639), sender: "Priya Nair", text: "YES i will cook. i've been wanting an excuse to do a real table" },
    { ts: ago(639, 22), sender: "Maya Chen", text: "i'm in, i can host if it's before august" },
    { ts: ago(638), sender: "Dev Raman", text: "putting it in the calendar so it actually happens this time" },
    { ts: ago(520), sender: "Priya Nair", text: "so are we doing this or" },
    { ts: ago(372), sender: "Theo Okafor", text: "reviving this chat once a year like clockwork lol" },
    { ts: ago(301), sender: "Maya Chen", text: "genuinely though. someone pick a date and i'll fly" }
  );
  threads.push({ file: "WhatsApp Chat with Hillview 2025.txt", lines: l });
}

/* ------------------------------------------------------------------ */

mkdirSync(OUT, { recursive: true });
for (const t of threads) {
  writeFileSync(join(OUT, t.file), format(t.lines), "utf8");
  console.log(`  ${t.file.padEnd(44)} ${t.lines.length} messages`);
}
console.log(`\n${threads.length} threads written to data/corpus`);
