import { NextResponse } from "next/server";
import type { Evidence, TieView } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Muse Spark is OpenAI-compatible, so one client shape covers Muse, OpenAI and
 * anything else we might need to fall back to on hackathon wifi. Set
 * LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in .env.local.
 */
const BASE = process.env.LLM_BASE_URL ?? "https://api.meta.ai/v1";
const KEY = process.env.META_API_KEY ?? process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL ?? "muse-spark-1.3";

const SYSTEM = `You write one short message reopening a friendship that has gone quiet.

Rules:
- 2 to 4 sentences. Text message length, not an email.
- Open with the specific unfinished thing, not with the silence. Never start with "Hey stranger", "Long time no see", "I know it's been forever" or any variant.
- Reference at most two pieces of evidence. Quote or paraphrase them concretely enough that the friend knows you actually remembered.
- Acknowledge the gap once, briefly, without a paragraph of apology. No guilt, no grovelling.
- End with one concrete, low-pressure opening: a question they can answer in one line, or a specific suggestion with a time attached.
- Sound like a person texting a friend. Lowercase is fine. No emdashes, no emoji, no corporate warmth, no "I hope this finds you well".

Return strict JSON only:
{"message": "...", "cites": ["<messageId>", ...]}

"cites" lists the messageId of each piece of evidence you actually used.`;

function brief(tie: TieView): string {
  const lines = tie.evidence.slice(0, 5).map((e) => {
    return `- id=${e.messageId} [${e.kind}] ${e.sender} said: "${e.quote}" (${e.reason})`;
  });

  return [
    `Friend: ${tie.friend}`,
    `Silent for: ${tie.silenceDays} days`,
    `At its peak you exchanged about ${Math.round(tie.peakPerWeek)} messages a week.`,
    tie.yourShare < 0.38
      ? "They sent most of the messages. You were the one who let it drop."
      : tie.yourShare > 0.62
        ? "You sent most of the messages."
        : "You both put in about the same.",
    "",
    "Unfinished things, strongest first:",
    ...lines,
  ].join("\n");
}

/**
 * Used when no key is configured. Deterministic, grounded in the same evidence,
 * and good enough that a demo never dies on a missing environment variable.
 */
function fallback(tie: TieView): { message: string; cites: string[] } {
  const first = tie.friend.split(" ")[0];
  const loop = tie.evidence.find((e) => e.kind === "open-loop");
  const plan = tie.evidence.find((e) => e.kind === "promise" || e.kind === "want");
  const cites = [loop, plan].filter(Boolean).map((e) => (e as Evidence).messageId);

  const parts: string[] = [];

  if (loop) {
    parts.push(
      `${first}, you asked me "${loop.quote.replace(/["“”]/g, "")}" and I never answered you. that has been sitting with me.`
    );
  } else {
    parts.push(`${first}, it has been ${tie.silenceDays} days and that is on me.`);
  }

  if (plan) {
    parts.push(
      `also still thinking about "${plan.quote.replace(/["“”]/g, "")}". we said it and then never did it.`
    );
  }

  parts.push(
    plan
      ? `are you free any evening in the next couple of weeks? i would genuinely like to finally make that happen.`
      : `no agenda, i just want to catch up properly. are you around for a call this week?`
  );

  return { message: parts.join("\n\n"), cites };
}

export async function POST(req: Request) {
  const { tie, owner } = (await req.json()) as { tie: TieView; owner: string };

  if (!tie) {
    return NextResponse.json({ error: "No friendship supplied." }, { status: 400 });
  }

  if (!KEY) {
    return NextResponse.json({ ...fallback(tie), model: "grounded template" });
  }

  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `You are ${owner}.\n\n${brief(tie)}` },
        ],
      }),
    });

    if (!res.ok) throw new Error(`${MODEL} returned ${res.status}`);

    const body = await res.json();
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Empty completion.");

    const parsed = JSON.parse(raw) as { message?: string; cites?: string[] };
    if (!parsed.message) throw new Error("No message in completion.");

    // Only trust citations that point at evidence we actually supplied.
    const known = new Set(tie.evidence.map((e) => e.messageId));
    const cites = (parsed.cites ?? []).filter((id) => known.has(id));

    return NextResponse.json({ message: parsed.message.trim(), cites, model: MODEL });
  } catch {
    // Never let a flaky endpoint take the demo down.
    return NextResponse.json({ ...fallback(tie), model: "grounded template" });
  }
}
