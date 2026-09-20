/**
 * The nostalgia recap.
 *
 * The open loops tell you what you owe someone. This tells you why it was
 * worth having, which is the part that actually makes you press send.
 *
 * The moments are found arithmetically in recap.ts, from how people typed. The
 * model only writes the connective tissue, and it is given the moments rather
 * than the archive, so it cannot invent a memory that did not happen.
 */

import { NextResponse } from "next/server";
import { bookends, highlights, type Moment } from "@/lib/recap";
import { recallDurable } from "@/lib/session";

export const runtime = "nodejs";

const BASE = process.env.LLM_BASE_URL ?? "https://api.meta.ai/v1";
const SERVER_KEY = process.env.META_API_KEY ?? process.env.LLM_API_KEY;

/**
 * The caller's own key wins. It arrives per request, is used once, and is
 * never logged or persisted; the server's key is only the fallback.
 */
function keyFor(req: Request): string | undefined {
  return req.headers.get("x-muse-key") ?? SERVER_KEY;
}
const MODEL = process.env.LLM_MODEL ?? "muse-spark-1.3";

const SYSTEM = `You write a short nostalgic recap of a friendship from real moments.

You are given moments pulled out of two people's chat history: times they could
not stop laughing, nights they stayed up talking, bursts where neither could
type fast enough, and messages somebody stopped to actually write.

Rules:
- One sentence per moment, in the order given. Present tense is fine.
- Say what was actually happening, using the messages. Never invent a detail
  that is not in them. If a moment is mundane, say it plainly; the mundane ones
  are often the good ones.
- No therapy voice, no "what a beautiful journey", no summarising the friendship
  as a whole. You are captioning photographs, not writing a eulogy.
- Keep each caption under 20 words.
- Then one closing line, under 25 words, naming what this friendship was like.
  Concrete, not sentimental.

Return strict JSON only:
{"captions": [{"ts": <the ts you were given>, "caption": "..."}], "closing": "..."}`;

function brief(moments: Moment[], friend: string, owner: string): string {
  return [
    `The friendship: ${owner} and ${friend}.`,
    "",
    ...moments.map((m) => {
      const when = new Date(m.ts).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      const lines = m.messages.map((x) => `    ${x.sender}: ${x.text}`).join("\n");
      return `Moment ts=${m.ts} [${m.kind}] ${when}, ${m.label}:\n${lines}`;
    }),
  ].join("\n");
}

export async function POST(req: Request) {
  const KEY = keyFor(req);
  const { session, thread } = (await req.json()) as {
    session?: string;
    thread?: string;
  };

  const held = session ? await recallDurable(session) : null;
  if (!held) {
    return NextResponse.json(
      { error: "That archive is no longer loaded. Upload again." },
      { status: 410 }
    );
  }

  const target = held.threads.find((t) => t.name === thread);
  if (!target) {
    return NextResponse.json({ error: "No such thread." }, { status: 404 });
  }

  const moments = highlights(target.messages);
  const ends = bookends(target.messages);

  if (!moments.length) {
    return NextResponse.json({
      moments: [],
      note: "Not enough back and forth here to build a recap.",
    });
  }

  const friend = target.participants.find((p) => p !== held.owner) ?? target.name;

  if (!KEY) {
    return NextResponse.json({ moments, bookends: ends, model: "no narration" });
  }

  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: brief(moments, friend, held.owner) },
        ],
      }),
    });

    if (!res.ok) throw new Error(`${MODEL} returned ${res.status}`);

    const body = await res.json();
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}");

    // Attach captions to the moments they belong to, dropping any the model
    // invented a timestamp for.
    const byTs = new Map<number, string>(
      (parsed.captions ?? []).map((c: { ts: number; caption: string }) => [
        Number(c.ts),
        c.caption,
      ])
    );

    return NextResponse.json({
      moments: moments.map((m) => ({ ...m, caption: byTs.get(m.ts) ?? null })),
      bookends: ends,
      closing: parsed.closing ?? null,
      model: MODEL,
    });
  } catch {
    return NextResponse.json({ moments, bookends: ends, model: "no narration" });
  }
}
