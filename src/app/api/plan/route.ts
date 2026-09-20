/**
 * The group planner.
 *
 * Reopening one friendship is a message. Reopening a group is a plan, and the
 * hard part of a group plan is that nobody remembers what anyone wanted. That
 * evidence is sitting in five separate threads, which is why this route is the
 * one that genuinely needs search: it asks every archive the same question at
 * once, then asks a model to find the single thing that answers all of them.
 */

import { NextResponse } from "next/server";
import { search, type Backend, type Hit } from "@/lib/search";
import { recall } from "@/lib/session";
import type { TieView } from "@/lib/types";

export const runtime = "nodejs";

const BASE = process.env.LLM_BASE_URL ?? "https://api.meta.ai/v1";
const KEY = process.env.META_API_KEY ?? process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL ?? "muse-spark-1.3";

/**
 * The questions we put to the archive. Each one is a different way somebody
 * signals an appetite for something, and running them as searches rather than
 * patterns means a phrasing nobody anticipated still scores.
 */
const PROBES = [
  "always wanted to try",
  "been meaning to do",
  "we should go together sometime",
  "dying to see",
  "never got round to it",
  "next time we are all together",
  "obsessed with",
  "my favourite place to eat",
];

export type PlanCandidate = {
  title: string;
  /** Why this, in one sentence, referring to the evidence. */
  rationale: string;
  /** Per person: the message that says they would like this. */
  because: { person: string; quote: string; msgId: string }[];
  estimatedPerPerson: number;
  /** What would rule this out, stated up front rather than discovered later. */
  risk: string;
};

/* ------------------------------------------------------------------ */

async function gather(
  session: string,
  people: string[]
): Promise<{ hits: Hit[]; backend: Backend }> {
  const results = await Promise.all(
    PROBES.map((probe) =>
      search(session, probe, { size: 12, excludeOwner: true, threads: people })
    )
  );

  const backend = results.find((r) => r.backend === "elasticsearch")
    ? "elasticsearch"
    : "in-memory";

  const seen = new Set<string>();
  const hits: Hit[] = [];

  for (const hit of results.flatMap((r) => r.hits).sort((a, b) => b.score - a.score)) {
    if (!people.includes(hit.thread)) continue;
    if (seen.has(hit.msgId)) continue;
    if (hit.text.split(/\s+/).length < 6) continue;
    seen.add(hit.msgId);
    hits.push(hit);
  }

  // Keep the field even: the loudest thread should not own the whole plan.
  const perPerson = new Map<string, Hit[]>();
  for (const h of hits) {
    const list = perPerson.get(h.thread) ?? [];
    if (list.length < 5) list.push(h);
    perPerson.set(h.thread, list);
  }

  return { hits: [...perPerson.values()].flat(), backend };
}

const SYSTEM = `You plan one gathering for a group of friends who have drifted apart.

You are given real messages these people sent, months or years ago, about
things they wanted to do. Propose plans that the evidence actually supports.

Rules:
- Propose exactly 3 options, most defensible first.
- Every option must cite at least two different people, quoting the message that
  justifies including them. Never invent a quote or attribute one to the wrong person.
- If the evidence for an option is thin, say so in the risk field rather than
  dressing it up. An honest "only two of the five have shown interest in this" is
  worth more than false confidence.
- estimatedPerPerson is a rough figure in the group's local currency, as a number.
- No invented compatibility scores, no percentages, no "97% match".
- Titles are concrete and short: "Pottery class then dinner", not "An Evening of Connection".

Return strict JSON only:
{"plans": [{"title": "...", "rationale": "...", "because": [{"person": "...", "quote": "...", "msgId": "..."}], "estimatedPerPerson": 40, "risk": "..."}]}`;

function fallbackPlans(hits: Hit[], people: string[]): PlanCandidate[] {
  const byPerson = new Map<string, Hit>();
  for (const h of hits) if (!byPerson.has(h.thread)) byPerson.set(h.thread, h);

  const because = [...byPerson.entries()].slice(0, 3).map(([person, h]) => ({
    person,
    quote: h.text.slice(0, 160),
    msgId: h.msgId,
  }));

  return [
    {
      title: "A long dinner, one table, everyone",
      rationale:
        "The safest thing the evidence supports: everyone in this group has at some point asked to see the others properly rather than in passing.",
      because,
      estimatedPerPerson: 45,
      risk: "Generic. It works, but nothing in the archive points at it specifically.",
    },
  ];
}

export async function POST(req: Request) {
  const { session, people, ties } = (await req.json()) as {
    session: string;
    people: string[];
    ties?: TieView[];
  };

  if (!session || !people?.length) {
    return NextResponse.json({ error: "Pick at least two friends." }, { status: 400 });
  }

  // Without this, an expired session falls through to an empty search and the
  // response blames the friendships: "nothing in these threads says what
  // anyone wanted to do". The archive was simply gone.
  if (!recall(session)) {
    return NextResponse.json(
      { error: "That archive is no longer loaded. Load it again and retry." },
      { status: 410 }
    );
  }

  let hits: Hit[];
  let backend: Backend;
  try {
    ({ hits, backend } = await gather(session, people));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed." },
      { status: 502 }
    );
  }

  if (!hits.length) {
    return NextResponse.json({
      plans: [],
      evidence: [],
      note: "Nothing in these threads says what anyone wanted to do. Pick friends with more history.",
    });
  }

  if (!KEY) {
    return NextResponse.json({
      plans: fallbackPlans(hits, people),
      evidence: hits,
      backend,
      model: "grounded template",
    });
  }

  const brief = [
    `The group: ${people.join(", ")}.`,
    ties?.length
      ? `They have been quiet for ${Math.round(
          ties.reduce((n, t) => n + t.silenceDays, 0) / ties.length
        )} days on average.`
      : "",
    "",
    "What they said they wanted, pulled from their own messages:",
    ...hits.map((h) => `- id=${h.msgId} ${h.thread} said: "${h.text}"`),
  ]
    .filter(Boolean)
    .join("\n");

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
          { role: "user", content: brief },
        ],
      }),
    });

    if (!res.ok) throw new Error(`${MODEL} returned ${res.status}`);

    const body = await res.json();
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
    const known = new Set(hits.map((h) => h.msgId));

    // Drop any citation that does not point at a message we actually supplied.
    const plans: PlanCandidate[] = (parsed.plans ?? []).map((p: PlanCandidate) => ({
      ...p,
      because: (p.because ?? []).filter((b) => known.has(b.msgId)),
    }));

    return NextResponse.json({ plans, evidence: hits, backend, model: MODEL });
  } catch {
    return NextResponse.json({
      plans: fallbackPlans(hits, people),
      evidence: hits,
      backend,
      model: "grounded template",
    });
  }
}
