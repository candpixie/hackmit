/**
 * Instagram / Meta data export parser.
 *
 * "Download your information" hands back one folder per conversation, each
 * holding an HTML transcript. The markup is generated, so it is regular enough
 * to read with a scanner rather than a DOM parser, which matters when there
 * are four hundred of them.
 *
 * Two things differ from WhatsApp and both bite:
 *   - messages are written newest first
 *   - reactions, shares and "liked a message" are rendered as messages
 */

import type { Message, Thread } from "./parse";

/** <h2 class="… _a6-h …">sender</h2> */
const BLOCK =
  /<div class="pam[^"]*_a6-g[^"]*">\s*<h2[^>]*_a6-h[^>]*>(.*?)<\/h2>\s*<div[^>]*_a6-p[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*_a6-o[^>]*>(.*?)<\/div>/g;

const TITLE = /<h1[^>]*>(.*?)<\/h1>/;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Instagram writes "Nov 10, 2025 3:47 pm". */
function parseStamp(raw: string): number | null {
  const m = raw
    .trim()
    .match(/^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*([ap])m$/i);
  if (!m) return null;

  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;

  let hour = Number(m[4]);
  const pm = m[6].toLowerCase() === "p";
  if (hour === 12) hour = pm ? 12 : 0;
  else if (pm) hour += 12;

  const d = new Date(Number(m[3]), month, Number(m[2]), hour, Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'",
};

function decode(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code.startsWith("#")) {
        const n = Number(code.slice(1));
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Within a message cell the export nests several divs: the text, then any
 * attachments as anchors, then a <ul class="_a6-q"> holding everyone's
 * reactions. Decoding the cell whole splices all three together, so a question
 * comes out as "Are you feeling better?❤️Summer (Sep 24, 2023 11:55 pm)".
 * Strip the parts nobody typed before decoding anything.
 */
/** How many people reacted to this message. The list is stripped, the count is not. */
function countReactions(cell: string): number {
  const list = cell.match(/<ul[^>]*_a6-q[^>]*>([\s\S]*?)<\/ul>/i);
  if (!list) return 0;
  return (list[1].match(/<li\b/gi) ?? []).length;
}

function extractText(cell: string): string {
  const withoutReactions = cell.replace(/<ul[^>]*_a6-q[^>]*>[\s\S]*?<\/ul>/gi, "");
  const withoutShares = withoutReactions.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ");
  return decode(withoutShares);
}

/**
 * The export renders a lot of things as messages that nobody typed. Reactions
 * and shares especially: left in, they swamp the signal, because half of
 * Instagram is reacting to things.
 */
const NOT_SPEECH = [
  // The export writes these with the username in front: "sydn.e liked a
  // message". Anchoring on the phrase alone let every one of them through.
  /^\S{0,40}\s*liked a message$/i,
  /\breacted\b.*\bto your message$/i,
  /^[^ ]* to your message$/i,
  /^\S{0,40}\s*(unsent|removed) a message$/i,
  /^(sent|shared) an? (attachment|photo|video|voice message|story|reel|post)/i,
  /^you (sent|shared)/i,
  /^this message (is no longer available|was unsent)/i,
  /^(missed|started) (a )?(video|voice|audio) (call|chat)/i,
  /^.{0,40}\bsent an attachment\.?$/i,
  /^changed the (theme|group name|chat)/i,
  /^(added|removed) .* (to|from) the (group|chat)/i,
  /^https?:\/\/\S+$/i, // a bare link is a share, not a sentence
];

function isSpeech(text: string): boolean {
  if (!text || text.length < 2) return false;
  // A reel someone forwarded carries its caption into the transcript. The
  // caption is not their words, however long it is.
  if (/\bsent an attachment\b/i.test(text)) return false;
  return !NOT_SPEECH.some((re) => re.test(text));
}

/** The folder is named handle_17950517471278735; the handle is the useful half. */
export function threadNameFromFolder(folder: string): string {
  return folder.replace(/_\d{6,}$/, "").trim() || folder;
}

export function parseInstagramHtml(html: string, fallbackName: string): Thread {
  const titled = html.match(TITLE)?.[1];
  const name = titled ? decode(titled) : fallbackName;

  const rows: { sender: string; text: string; ts: number; reactions: number }[] = [];

  BLOCK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BLOCK.exec(html)) !== null) {
    const sender = decode(match[1]);
    const text = extractText(match[2]);
    const ts = parseStamp(decode(match[3]));

    if (ts === null || !sender) continue;
    if (!isSpeech(text)) continue;

    rows.push({ sender, text, ts, reactions: countReactions(match[2]) });
  }

  // The export is newest first, and everything downstream assumes time runs
  // forwards.
  rows.sort((a, b) => a.ts - b.ts);

  const messages: Message[] = rows.map((r, i) => ({
    id: `${name}#${i}`,
    thread: name,
    sender: r.sender,
    ts: r.ts,
    text: r.text,
    reactions: r.reactions,
  }));

  const participants = [...new Set(messages.map((m) => m.sender))];

  return { name, participants, isGroup: participants.length > 2, messages };
}
