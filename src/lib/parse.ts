/**
 * WhatsApp "Export Chat (Without Media)" parser.
 *
 * WhatsApp writes two very different formats depending on the exporting phone,
 * and both are littered with invisible direction marks. We normalise first,
 * then try each shape.
 *
 *   iOS      [2024-03-15, 9:41:03 PM] Maya Chen: hey are you around
 *   Android  3/15/24, 9:41 PM - Maya Chen: hey are you around
 */

export type Message = {
  id: string;
  thread: string;
  sender: string;
  ts: number; // epoch ms
  text: string;
  /** How many people reacted. Instagram only; absent for WhatsApp exports. */
  reactions?: number;
};

export type Thread = {
  name: string;
  participants: string[];
  isGroup: boolean;
  messages: Message[];
};

// LTR/RTL marks, BOM, narrow no-break space inside timestamps.
const INVISIBLE = /[‎‏﻿]/g;
const NARROW_NBSP = /[  ]/g;

const IOS = /^\[(.+?)\]\s([^:]+?):\s([\s\S]*)$/;
const ANDROID = /^(\d{1,2}\/\d{1,2}\/\d{2,4},\s\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp][Mm])?)\s-\s([^:]+?):\s([\s\S]*)$/;

// Lines WhatsApp injects that are not human speech.
const SYSTEM = [
  /Messages and calls are end-to-end encrypted/i,
  /^You created group/i,
  /(added|removed|left|joined|changed the subject|changed this group|changed their phone number)/i,
  /^(image|video|audio|sticker|document|GIF|Contact card) omitted$/i,
  /<Media omitted>/i,
  /^This message was deleted/i,
  /^Missed (voice|video) call/i,
  /^null$/i,
];

/** WhatsApp annotates message bodies in place. None of it is speech. */
function clean(body: string): string {
  return body
    .replace(/<This message was edited>/gi, "")
    .replace(/\(file attached\)/gi, "")
    .replace(/<attached: [^>]*>/gi, "")
    .replace(/\u200e/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSystem(sender: string, text: string): boolean {
  if (!text.trim()) return true;
  return SYSTEM.some((re) => re.test(text) || re.test(sender));
}

/**
 * WhatsApp does not say whether a date is D/M or M/D — it depends on the
 * exporting phone's locale. We infer it from the whole file: if any component
 * exceeds 12 it must be the day, which settles the order for every line.
 */
function inferDayFirst(stamps: string[]): boolean {
  for (const s of stamps) {
    const m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) return true;
    if (b > 12) return false;
  }
  return false; // ambiguous everywhere: assume US order
}

const TIME = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/;

function parseStamp(raw: string, dayFirst: boolean): number | null {
  const s = raw.replace(NARROW_NBSP, " ").trim();

  // iOS in ISO locales: 2026-09-19, 9:41:03 PM
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2}),?\s+(.+)$/);
  if (iso) {
    const t = iso[4].match(TIME);
    if (!t) return null;
    return build(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3]),
      Number(t[1]),
      Number(t[2]),
      Number(t[3] ?? 0),
      t[4]
    );
  }

  const m = s.match(
    /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/
  );
  if (!m) return null;

  const [, p1, p2, yRaw, hRaw, min, sec, ampm] = m;
  const day = Number(dayFirst ? p1 : p2);
  const month = Number(dayFirst ? p2 : p1);
  let year = Number(yRaw);
  if (year < 100) year += 2000;
  return build(year, month, day, Number(hRaw), Number(min), Number(sec ?? 0), ampm);
}

function build(
  year: number,
  month: number,
  day: number,
  hRaw: number,
  min: number,
  sec: number,
  ampm?: string
): number | null {

  let hour = hRaw;
  if (ampm) {
    const pm = /[Pp]/.test(ampm[0]);
    if (hour === 12) hour = pm ? 12 : 0;
    else if (pm) hour += 12;
  }

  const d = new Date(year, month - 1, day, hour, min, sec);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export function parseChat(raw: string, threadName: string): Thread {
  const text = raw.replace(INVISIBLE, "");
  const lines = text.split(/\r?\n/);

  // Pass 1: collect stamps so we can settle D/M vs M/D for the whole file.
  const stamps: string[] = [];
  for (const line of lines) {
    const m = line.match(IOS) ?? line.match(ANDROID);
    if (m) stamps.push(m[1]);
  }
  const dayFirst = inferDayFirst(stamps);

  // Pass 2: build messages, folding continuation lines into the message above.
  const messages: Message[] = [];
  let n = 0;

  for (const line of lines) {
    const m = line.match(IOS) ?? line.match(ANDROID);

    if (!m) {
      // A wrapped line belongs to the previous message.
      if (messages.length && line.trim()) {
        messages[messages.length - 1].text += "\n" + line.trim();
      }
      continue;
    }

    const [, stamp, senderRaw, body] = m;
    const ts = parseStamp(stamp, dayFirst);
    if (ts === null) continue;

    const sender = senderRaw.trim();
    if (isSystem(sender, body)) continue;

    const text = clean(body);
    if (!text) continue;

    messages.push({
      id: `${threadName}#${n++}`,
      thread: threadName,
      sender,
      ts,
      text,
    });
  }

  const participants = [...new Set(messages.map((m) => m.sender))];

  return {
    name: threadName,
    participants,
    isGroup: participants.length > 2,
    messages,
  };
}

/**
 * The owner of the export is whoever speaks in every thread. Falls back to the
 * most prolific sender when there is only one thread to compare.
 */
export function inferOwner(threads: Thread[]): string {
  const appearances = new Map<string, number>();
  for (const t of threads) {
    for (const p of new Set(t.participants)) {
      appearances.set(p, (appearances.get(p) ?? 0) + 1);
    }
  }

  const everywhere = [...appearances.entries()]
    .filter(([, count]) => count === threads.length)
    .map(([name]) => name);

  if (everywhere.length === 1) return everywhere[0];

  const volume = new Map<string, number>();
  for (const t of threads) {
    for (const m of t.messages) {
      volume.set(m.sender, (volume.get(m.sender) ?? 0) + 1);
    }
  }

  const pool = everywhere.length ? everywhere : [...volume.keys()];
  return pool.sort((a, b) => (volume.get(b) ?? 0) - (volume.get(a) ?? 0))[0] ?? "You";
}

/**
 * Two conversations can carry the same display name: deleted accounts all
 * export as "Instagram user", and handles repeat. Message ids are built from
 * the thread name, so a collision means one thread's messages overwrite
 * another's in any store keyed by id. Eighteen conversations vanished this way
 * on a real archive.
 */
export function dedupeThreadNames(threads: Thread[]): Thread[] {
  const seen = new Map<string, number>();

  return threads.map((t) => {
    const n = seen.get(t.name) ?? 0;
    seen.set(t.name, n + 1);
    if (n === 0) return t;

    const name = `${t.name} (${n + 1})`;
    return {
      ...t,
      name,
      messages: t.messages.map((m, i) => ({ ...m, thread: name, id: `${name}#${i}` })),
    };
  });
}
