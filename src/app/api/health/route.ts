/**
 * Proof that the three sponsor integrations are actually running.
 *
 * Every check hits the real service and reports what came back, so the answer
 * to "is Elastic really wired in" is a live call rather than a claim.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.LLM_BASE_URL ?? "https://api.meta.ai/v1";
const MUSE_KEY = process.env.META_API_KEY ?? process.env.LLM_API_KEY;
const ES_URL = process.env.ELASTIC_URL;
const ES_KEY = process.env.ELASTIC_API_KEY;

type Check = {
  sponsor: string;
  what: string;
  ok: boolean;
  detail: string;
  ms: number;
};

async function timed<T>(fn: () => Promise<T>): Promise<[T | null, number, string | null]> {
  const t0 = Date.now();
  try {
    return [await fn(), Date.now() - t0, null];
  } catch (e) {
    return [null, Date.now() - t0, e instanceof Error ? e.message : String(e)];
  }
}

/** Meta: ask the model API which models it will serve us. */
async function checkMuse(): Promise<Check> {
  if (!MUSE_KEY) {
    return { sponsor: "Meta", what: "Muse Spark", ok: false, detail: "No META_API_KEY set.", ms: 0 };
  }

  const [res, ms, err] = await timed(async () => {
    const r = await fetch(`${BASE}/models`, {
      headers: { authorization: `Bearer ${MUSE_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`${r.status} from ${BASE}/models`);
    return (await r.json()) as { data?: { id: string }[] };
  });

  if (err || !res) {
    return { sponsor: "Meta", what: "Muse Spark", ok: false, detail: err ?? "No response.", ms };
  }

  const ids = (res.data ?? []).map((m) => m.id);
  const model = process.env.LLM_MODEL ?? "muse-spark-1.3";
  return {
    sponsor: "Meta",
    what: "Muse Spark",
    ok: ids.includes(model),
    detail: ids.includes(model)
      ? `${BASE} is serving ${model}, ${ids.length} models available.`
      : `${model} not in the ${ids.length} models this key can reach.`,
    ms,
  };
}

/** Elastic: count the documents actually sitting in the index. */
async function checkElastic(): Promise<Check> {
  if (!ES_URL || !ES_KEY) {
    return { sponsor: "Elastic", what: "Elasticsearch", ok: false, detail: "No ELASTIC_URL or ELASTIC_API_KEY set.", ms: 0 };
  }

  const [res, ms, err] = await timed(async () => {
    const r = await fetch(`${ES_URL.replace(/\/$/, "")}/overdue-messages/_count`, {
      headers: { authorization: `ApiKey ${ES_KEY}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`${r.status} from the cluster`);
    return (await r.json()) as { count: number };
  });

  if (err || !res) {
    return { sponsor: "Elastic", what: "Elasticsearch", ok: false, detail: err ?? "No response.", ms };
  }

  return {
    sponsor: "Elastic",
    what: "Elasticsearch",
    ok: true,
    detail: `${res.count.toLocaleString()} messages indexed in overdue-messages.`,
    ms,
  };
}

/** Visa: run the guardrail and check it refuses to overspend. */
async function checkVisa(origin: string): Promise<Check> {
  const [res, ms, err] = await timed(async () => {
    const r = await fetch(`${origin}/api/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Gallery exhibition", headcount: 4, capPerPerson: 20 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`${r.status} from checkout`);
    return (await r.json()) as {
      perPerson: number;
      guardrail: { withinCap: boolean; adjustment: string | null };
      credential: { type: string; expiresAt: string };
      sandbox: boolean;
    };
  });

  if (err || !res) {
    return { sponsor: "Visa", what: "Agentic checkout", ok: false, detail: err ?? "No response.", ms };
  }

  // The guardrail is only working if it refuses, and says so honestly.
  const refused = !res.guardrail.withinCap && Boolean(res.guardrail.adjustment);
  return {
    sponsor: "Visa",
    what: "Agentic checkout",
    ok: refused && res.sandbox,
    detail: refused
      ? `Cap $20, agent landed at $${res.perPerson}. "${res.guardrail.adjustment}" Credential is ${res.credential.type}, sandbox.`
      : "The guardrail did not refuse an over-cap cart.",
    ms,
  };
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const checks = await Promise.all([checkMuse(), checkElastic(), checkVisa(origin)]);

  return NextResponse.json(
    { checkedAt: new Date().toISOString(), allOk: checks.every((c) => c.ok), checks },
    { headers: { "cache-control": "no-store" } }
  );
}
