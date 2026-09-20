/**
 * Generates a synthetic Instagram export, in the exact shape "Download your
 * information" produces, so the whole team can demo without anyone's real DMs.
 *
 *   pnpm ig-corpus            -> data/corpus-instagram/inbox
 *   pnpm ig data/corpus-instagram/inbox
 *
 * The cast is built to exercise every path in the engine:
 *
 *   mei.tanaka        the flagship dormant tie: open loops, a broken promise,
 *                     a want, and a milestone nobody acknowledged
 *   rafa.ortiz        still warm, messaged this week. Must NOT be flagged
 *   priya.raman       she carried it, you let it drop
 *   jonas.weber       brief and intense, then two years of nothing
 *   cohort2027        the group chat the Friendsgiving planner works on
 *   crit.group        a busy group you never posted in. Must rank low
 *   studio.ops        high volume, pure logistics. A colleague, not a friend
 *   Instagram user    a deleted account, which must be filtered out
 *
 * Every name is invented. Deterministic: same seed, same corpus.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OWNER = "you";
const OUT = join(process.cwd(), "data", "corpus-instagram", "inbox");

const NOW = new Date("2026-09-19T12:00:00").getTime();
const DAY = 86_400_000;

let seed = 19092026;
function rand(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pick<T>(xs: T[]): T {
  return xs[Math.floor(rand() * xs.length)];
}

type Line = {
  ts: number;
  sender: string;
  text?: string;
  /** Rendered as an anchor, the way a shared reel is. Must be stripped. */
  share?: string;
  /** Rendered as "<name> sent an attachment." Must be stripped. */
  attachment?: string;
  /** Rendered into the reaction list. Must not join the message text. */
  reaction?: string;
};

/* ------------------------------------------------------------------ */
/* markup                                                              */
/* ------------------------------------------------------------------ */

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

function stamp(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${mm} ${ampm}`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cell(line: Line): string {
  const body = line.attachment
    ? `${escape(line.sender)} sent an attachment.${escape(line.attachment)}`
    : escape(line.text ?? "");

  const shareHtml = line.share
    ? `<div><div><div><a target="_blank" href="${line.share}">${line.share}</a></div></div></div>`
    : "<div></div>";

  const reactionHtml = line.reaction
    ? `<ul class="_a6-q"><li><span>${escape(line.reaction)}</span></li></ul>`
    : "";

  return (
    `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">` +
    `<h2 class="_3-95 _2pim _a6-h _a6-i">${escape(line.sender)}</h2>` +
    `<div class="_3-95 _a6-p"><div><div></div><div>${body}</div>${shareHtml}<div></div>${reactionHtml}</div></div>` +
    `<div class="_3-94 _a6-o">${stamp(line.ts)}</div>` +
    `</div>`
  );
}

/** Instagram writes newest first, which the parser has to undo. */
function document_(title: string, lines: Line[]): string {
  const body = [...lines]
    .sort((a, b) => b.ts - a.ts)
    .map(cell)
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Instagram</title>
<style>._a6-g{background:#fff}._a6-h{font-weight:700}._a6-o{color:#8d949e}._a6-q{color:gray}</style>
</head><body class="_5vb_ _2yq _a7o5"><div class="_li"><div class="_a705">
<header class="_as-_ _a70a"><div class="_a70d"><h1>${escape(title)}</h1></div></header>
<main class="_a706" role="main">${body}</main>
</div></div></body></html>`;
}

/* ------------------------------------------------------------------ */
/* chatter                                                             */
/* ------------------------------------------------------------------ */

const SMALL = [
  "ok but same", "wait what", "no way", "send it", "omg", "yeah", "fr",
  "that's so real", "ok wait", "hold on", "omw", "5 min", "sounds good",
  "bet", "literally me", "ok deal", "let me check", "maybe", "idk",
  "we'll see", "good morning", "night night", "same tbh",
  "one more week", "almost done", "did it work", "call me later",
  "just got home", "you up", "nvm figured it out", "that's rough",
  "tell me everything", "how'd it go", "wait really", "on it", "cool",
  // Nothing here may trip the candour pattern: filler that reads as
  // vulnerability scores every thread at maximum and flattens the ranking.
];

const FUNNY = [
  "lmaooo 😂", "stopppp 😭", "i'm crying 😂😂", "HAHAHAHA", "i'm dying 💀",
  "hahahaha stop", "i can't 😭", "LMAO", "💀💀💀", "screaming",
];

const OPEN = [
  "ok sorry for the essay but i've been thinking about this all week and i genuinely don't know what to do. everyone keeps telling me to just pick one and i think that's the part i'm stuck on",
  "i think i've been pretending i'm fine for so long that i forgot what the alternative feels like. anyway. that got heavy fast, ignore me",
  "honestly the thing that got me was that nobody asked. i would have said something if anyone had asked, and then i realised i haven't asked anyone anything in months either",
  "i'm so tired. not the sleep kind. i keep waiting for the part where it gets easier and i'm starting to think this is just the shape of it now",
  "i miss you. that's it, that's the message",
];

const LOGISTICS = [
  "can you send the deck before the meeting", "deadline moved to friday",
  "did you submit the form", "the client wants another round",
  "standup at 10", "i'll put it in the shared drive",
  "invoice went out", "can you review the ticket",
  "agenda's in the doc", "shift swap ok?",
  "the team needs the slides by eod", "pushed the deploy",
];

const REELS = [
  "https://www.instagram.com/reel/DJCVIaZM-Wy/",
  "https://www.instagram.com/reel/DK3mP4Thega/",
  "https://www.instagram.com/reel/DL31n24xMxq/",
];

const CAPTIONS = [
  "when you finally hand in the thing and immediately think of a better version #relatable",
  "POV: your friend says five minutes and you know it's forty #fyp #friends",
  "the way she just walked off 😭 #comedy #viral",
];

/**
 * Each friendship gets its own mix, so the closeness factors have something to
 * separate. A corpus where every thread is equally funny and equally open
 * makes every score identical, which demos worse than no scores at all.
 */
type Profile = {
  /** Share of messages that are laughter. */
  funny: number;
  /** Share that are somebody actually opening up. */
  open: number;
  /** Multiplier on message length, against the baseline. */
  verbosity: number;
  /** Everything is logistics. */
  work?: boolean;
};

const PROFILES: Record<string, Profile> = {
  // Deep and funny in equal measure. The benchmark friendship.
  mei: { funny: 0.2, open: 0.05, verbosity: 2.2 },
  // A joy to talk to, but it stays on the surface.
  rafa: { funny: 0.34, open: 0.002, verbosity: 0.7 },
  // She writes essays, you send "yeah".
  priya: { funny: 0.12, open: 0.06, verbosity: 1.8 },
  // Short, sharp, and very open when it counts.
  jonas: { funny: 0.26, open: 0.04, verbosity: 0.8 },
  // A group: warm but nobody is vulnerable in front of five people.
  cohort: { funny: 0.22, open: 0.004, verbosity: 1 },
  // A room you lurk in.
  crit: { funny: 0.08, open: 0, verbosity: 0.8 },
  // Colleagues.
  ops: { funny: 0.01, open: 0, verbosity: 1, work: true },
  plain: { funny: 0.1, open: 0.01, verbosity: 1 },
};

const PADDING =
  " and honestly i think that's the whole point of it, like you either commit or you keep circling it forever";

function chatter(
  from: number,
  to: number,
  perWeek: number,
  senders: string[],
  lines: Line[],
  profileKey: keyof typeof PROFILES = "plain"
) {
  const p = PROFILES[profileKey];
  const weeks = (to - from) / (7 * DAY);
  const n = Math.max(0, Math.round(weeks * perWeek));

  for (let i = 0; i < n; i++) {
    const d = new Date(from + rand() * (to - from));
    d.setHours(9 + Math.floor(rand() * 14), Math.floor(rand() * 60), 0);
    const sender = pick(senders);
    const roll = rand();

    if (p.work) {
      lines.push({ ts: d.getTime(), sender, text: pick(LOGISTICS) });
      continue;
    }

    // A share every so often, so the parser has attachments to strip.
    if (roll < 0.03) {
      lines.push({
        ts: d.getTime(),
        sender,
        attachment: pick(CAPTIONS),
        share: pick(REELS),
      });
      continue;
    }

    let text =
      roll < p.open ? pick(OPEN) : roll < p.open + p.funny ? pick(FUNNY) : pick(SMALL);

    // Verbosity is what the depth factor reads, so it has to show up in the
    // text rather than only in a parameter.
    if (p.verbosity > 1.4 && text.length < 40 && rand() < 0.5) {
      text = text + PADDING;
    } else if (p.verbosity < 0.85 && text.length > 60) {
      text = text.slice(0, 40).trim();
    }

    lines.push({
      ts: d.getTime(),
      sender,
      text,
      // Reactions are common and must never join the message body.
      reaction: rand() < 0.12 ? `❤${pick(senders.filter((s) => s !== sender))}` : undefined,
    });
  }
}

/** A late-night run, so the recap has a 3am conversation to find. */
function lateNight(dayAgo: number, senders: string[], lines: Line[], texts: string[]) {
  const base = new Date(NOW - dayAgo * DAY);
  base.setHours(2, 10, 0);
  texts.forEach((text, i) => {
    lines.push({
      ts: base.getTime() + i * 4 * 60_000,
      sender: senders[i % senders.length],
      text,
    });
  });
}

function ago(days: number, hour = 20): number {
  const d = new Date(NOW - days * DAY);
  d.setHours(hour, Math.floor(rand() * 60), 0);
  return d.getTime();
}

/* ------------------------------------------------------------------ */
/* the cast                                                            */
/* ------------------------------------------------------------------ */

const threads: { folder: string; title: string; lines: Line[] }[] = [];

/* ---- 1. Mei: the flagship dormant tie ------------------------------- */
{
  const M = "Mei Tanaka";
  const l: Line[] = [];
  chatter(ago(1020), ago(560), 26, [OWNER, M], l, "mei");
  chatter(ago(560), ago(430), 10, [OWNER, M], l, "mei");
  chatter(ago(430), ago(360), 3, [OWNER, M], l, "mei");

  lateNight(700, [M, OWNER], l, [
    "are you still awake",
    "unfortunately",
    "i keep thinking about whether i actually want this or whether i just want to have wanted it",
    "that's a 2am sentence if i ever heard one",
    "i'm serious though. like what if i get there and it's the same",
    "then you come home and we figure out the next one. that's genuinely it",
    "ok. ok that helped",
  ]);

  l.push(
    { ts: ago(980), sender: M, text: "i've always wanted to try ceramics, there's a studio two streets from me that does walk-ins" },
    { ts: ago(979), sender: OWNER, text: "we should go after the term ends" },
    { ts: ago(979, 22), sender: M, text: "YES ok i'm holding you to that", reaction: `❤${OWNER}` },
    { ts: ago(640), sender: M, text: "my flat is overflowing with stuff i genuinely do not need, i want to throw all of it away" },
    { ts: ago(548), sender: M, text: "i'm moving to Berlin in september btw. i got the residency" },
    { ts: ago(547), sender: OWNER, text: "WAIT congrats!!! we have to celebrate before you go" },
    { ts: ago(546), sender: M, text: "next time you're home let's finally do the ceramics thing" },
    { ts: ago(470), sender: M, text: "ok i'm officially here. everything is grey and closed on sundays" },
    { ts: ago(437), sender: M, text: "how did the showcase go?? you never told me" },
    { ts: ago(389), sender: M, text: "are you around this weekend? i'm back for my sister's thing" },
    { ts: ago(361), sender: M, text: "hey! no pressure at all. just realised it's been a while and i hope you're doing ok" }
  );
  threads.push({ folder: "meitanaka_17950517471278735", title: M, lines: l });
}

/* ---- 2. Rafa: still warm. The control case -------------------------- */
{
  const R = "Rafa Ortiz";
  const l: Line[] = [];
  chatter(ago(900), ago(3), 13, [OWNER, R], l, "rafa");
  l.push(
    { ts: ago(240), sender: R, text: "i've been meaning to get a proper espresso setup, the one at work is a crime scene" },
    { ts: ago(14), sender: R, text: "you free thursday? that noodle place finally opened" },
    { ts: ago(13), sender: OWNER, text: "yes finally. 7?" },
    { ts: ago(3), sender: R, text: "that was so good. same time next month, i'm booking it now", reaction: `❤${OWNER}` }
  );
  threads.push({ folder: "rafaortiz_17849201938471029", title: R, lines: l });
}

/* ---- 3. Priya: she carried it --------------------------------------- */
{
  const P = "Priya Raman";
  const l: Line[] = [];
  chatter(ago(960), ago(600), 16, [P, P, P, OWNER], l, "priya");
  chatter(ago(600), ago(300), 5, [P, P, OWNER], l, "priya");

  l.push(
    { ts: ago(780), sender: P, text: "i'm dying to see that exhibition before it closes and literally nobody will come with me" },
    { ts: ago(512), sender: P, text: "we should do a proper trip. like actually book something instead of talking about it for another year" },
    { ts: ago(333), sender: P, text: "did you end up moving? i saw the photos but i couldn't tell" },
    { ts: ago(301), sender: P, text: "ok i'll stop spamming you 😅 miss you though" }
  );
  threads.push({ folder: "priyaraman_17612094857102938", title: P, lines: l });
}

/* ---- 4. Jonas: brief, intense, then nothing ------------------------- */
{
  const J = "Jonas Weber";
  const l: Line[] = [];
  chatter(ago(820), ago(745), 34, [OWNER, J], l, "jonas");
  lateNight(760, [J, OWNER], l, [
    "i cannot sleep and it is your fault for bringing up the thing",
    "which thing",
    "the thing where you said i only ever pick the safe option",
    "i said it with love",
    "you said it with a smugness that i will be carrying to my grave",
    "ok that's fair. for what it's worth i don't think you're doing that anymore",
  ]);
  l.push(
    { ts: ago(815), sender: J, text: "i've always wanted to learn to cook properly, not just survive on the same four meals" },
    { ts: ago(752), sender: J, text: "when you're back in town we're doing the whole day. market, then cooking, then the worst possible film" },
    { ts: ago(746), sender: J, text: "how's the new place treating you" }
  );
  threads.push({ folder: "jonasweber_17398201938475610", title: J, lines: l });
}

/* ---- 5. The group chat the planner works on ------------------------- */
{
  const l: Line[] = [];
  const people = [OWNER, "Mei Tanaka", "Priya Raman", "Jonas Weber", "Rafa Ortiz"];
  chatter(ago(980), ago(600), 24, people, l, "cohort");
  chatter(ago(600), ago(340), 6, people, l, "cohort");

  l.push(
    { ts: ago(700), sender: "Jonas Weber", text: "we should all do a friendsgiving before everyone scatters for good" },
    { ts: ago(699), sender: "Priya Raman", text: "YES i will cook. i've been wanting an excuse to do a proper table for years" },
    { ts: ago(699, 22), sender: "Mei Tanaka", text: "i'm in, and i can host if it's before september", reaction: "❤Priya Raman" },
    { ts: ago(698), sender: "Rafa Ortiz", text: "putting it in the calendar so it actually happens this time" },
    { ts: ago(560), sender: "Priya Raman", text: "so are we doing this or" },
    { ts: ago(412), sender: "Jonas Weber", text: "reviving this chat once a year like clockwork lol" },
    { ts: ago(341), sender: "Mei Tanaka", text: "genuinely though. someone pick a date and i will fly for it" }
  );
  threads.push({ folder: "cohort2027_17201938475610293", title: "cohort 2027", lines: l });
}

/* ---- 6. A busy group you never posted in ---------------------------- */
{
  const l: Line[] = [];
  const lurkers = ["Noor Haddad", "Sam Okonkwo", "Elif Demir", "Tomas Vrba"];
  chatter(ago(900), ago(400), 60, lurkers, l, "crit");
  l.push(
    { ts: ago(430), sender: "Noor Haddad", text: "does anyone actually read this chat or are we all just lurking" },
    { ts: ago(401), sender: "Elif Demir", text: "wait is the crit on tuesday or wednesday" }
  );
  threads.push({ folder: "critgroup_17102938475610293", title: "crit group", lines: l });
}

/* ---- 7. High volume, pure logistics. A colleague -------------------- */
{
  const l: Line[] = [];
  const team = [OWNER, "Dana Fitz", "Marcus Lee"];
  chatter(ago(700), ago(30), 40, team, l, "ops");
  threads.push({ folder: "studioops_17093847561029384", title: "studio ops", lines: l });
}

/* ---- 8. A deleted account, which must be filtered out --------------- */
{
  const l: Line[] = [];
  chatter(ago(600), ago(420), 12, [OWNER, "Instagram user"], l, "plain");
  threads.push({
    folder: "instagramuser_17000000000000000",
    title: "Instagram user",
    lines: l,
  });
}

/* ------------------------------------------------------------------ */

rmSync(join(process.cwd(), "data", "corpus-instagram"), { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let total = 0;
for (const t of threads) {
  const dir = join(OUT, t.folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "message_1.html"), document_(t.title, t.lines), "utf8");
  total += t.lines.length;
  console.log(`  ${t.folder.padEnd(40)} ${String(t.lines.length).padStart(5)} messages`);
}

console.log(
  `\n${threads.length} conversations, ${total.toLocaleString()} messages -> data/corpus-instagram/inbox`
);
