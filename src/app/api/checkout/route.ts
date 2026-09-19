/**
 * Agentic checkout, sandbox.
 *
 * Shaped after Visa's Intelligent Commerce guidance for agents: the agent is
 * never handed an open payment instrument. It gets a credential scoped to one
 * merchant, one amount and one window, it has to show the human what it is
 * about to buy and why, and the human approves before anything moves.
 *
 * Nothing here charges a card. Every response is labelled sandbox, because a
 * demo that claims a real payment is a demo that lies.
 */

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type LineItem = { label: string; amount: number; note?: string };

export type Cart = {
  intentId: string;
  merchant: string;
  items: LineItem[];
  subtotal: number;
  perPerson: number;
  headcount: number;
  currency: string;
  /** Plain sentences explaining every decision the agent made. */
  reasoning: string[];
  guardrail: {
    capPerPerson: number;
    withinCap: boolean;
    /** Set when the agent had to change the plan to stay under the cap. */
    adjustment: string | null;
  };
  /** Scoped, single use, expires. The agent never holds anything broader. */
  credential: {
    type: "scoped-single-use";
    reference: string;
    maxAmount: number;
    merchantLock: string;
    expiresAt: string;
  };
  sandbox: true;
};

/**
 * Stands in for a merchant catalogue. Real discovery would hit a merchant or
 * aggregator API; the shape of what comes back is what matters for the flow.
 */
const CATALOGUE: Record<string, { merchant: string; unit: number; extras: LineItem[] }> =
  {
    pottery: {
      merchant: "Clay Studio, walk-in session",
      unit: 38,
      extras: [{ label: "Firing and glazing", amount: 8, note: "per piece" }],
    },
    cooking: {
      merchant: "Market and cookalong, half day",
      unit: 55,
      extras: [{ label: "Ingredients", amount: 12, note: "split at the market" }],
    },
    dinner: {
      merchant: "Set menu, long table",
      unit: 42,
      extras: [{ label: "Service", amount: 6 }],
    },
    exhibition: {
      merchant: "Gallery, timed entry",
      unit: 22,
      extras: [{ label: "Catalogue", amount: 9, note: "optional" }],
    },
  };

function categorise(title: string): keyof typeof CATALOGUE {
  const t = title.toLowerCase();
  if (/pottery|ceramic|clay|throw/.test(t)) return "pottery";
  if (/cook|market|kitchen|bake|chef/.test(t)) return "cooking";
  if (/exhibit|gallery|museum|show|art/.test(t)) return "exhibition";
  return "dinner";
}

export async function POST(req: Request) {
  const { title, headcount, capPerPerson, currency } = (await req.json()) as {
    title?: string;
    headcount?: number;
    capPerPerson?: number;
    currency?: string;
  };

  if (!title || !headcount || headcount < 1) {
    return NextResponse.json({ error: "Need a plan and a headcount." }, { status: 400 });
  }

  const cap = capPerPerson ?? 60;
  const kind = categorise(title);
  const entry = CATALOGUE[kind];

  const reasoning: string[] = [
    `Matched "${title}" to ${entry.merchant} from the plan the group chose.`,
    `Priced for ${headcount} ${headcount === 1 ? "person" : "people"}.`,
  ];

  let items: LineItem[] = [
    { label: entry.merchant, amount: entry.unit * headcount, note: `${headcount} × ${entry.unit}` },
    ...entry.extras.map((e) => ({ ...e, amount: e.amount * headcount })),
  ];

  let subtotal = items.reduce((n, i) => n + i.amount, 0);
  let perPerson = subtotal / headcount;
  let adjustment: string | null = null;

  // The guardrail is the point: the agent changes the order rather than
  // quietly exceeding what it was allowed to spend.
  if (perPerson > cap) {
    const optional = items.findIndex((i) => i.note?.includes("optional"));
    if (optional >= 0) {
      adjustment = `Dropped ${items[optional].label} to stay under ${currency ?? "$"}${cap} each.`;
      items = items.filter((_, i) => i !== optional);
      subtotal = items.reduce((n, i) => n + i.amount, 0);
      perPerson = subtotal / headcount;
      reasoning.push(adjustment);
    }
  }

  const withinCap = perPerson <= cap;
  if (!withinCap) {
    reasoning.push(
      `Still ${currency ?? "$"}${(perPerson - cap).toFixed(2)} over the cap. Not proceeding without a higher limit.`
    );
  } else {
    reasoning.push(
      `${currency ?? "$"}${perPerson.toFixed(2)} each, inside the ${currency ?? "$"}${cap} cap.`
    );
  }

  const cart: Cart = {
    intentId: randomUUID(),
    merchant: entry.merchant,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    perPerson: Math.round(perPerson * 100) / 100,
    headcount,
    currency: currency ?? "$",
    reasoning,
    guardrail: { capPerPerson: cap, withinCap, adjustment },
    credential: {
      type: "scoped-single-use",
      reference: `sbx_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      maxAmount: Math.round(subtotal * 100) / 100,
      merchantLock: entry.merchant,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    },
    sandbox: true,
  };

  return NextResponse.json(cart);
}
