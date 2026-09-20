import type { Metadata } from "next";
import type { CardsEnvelope } from "@/lib/cards";
import { InsightsDashboard } from "@/components/insights/InsightsDashboard";

export const metadata: Metadata = {
  title: "Insights · Your conversations, rediscovered",
  description:
    "The people, memories, and plans tucked inside your conversations.",
};

// Live cards from the engine. Falls back to the synthetic corpus when no
// session is supplied, so this page always renders something.
export const dynamic = "force-dynamic";

async function load(): Promise<CardsEnvelope> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3111";
  const res = await fetch(`${base}/api/cards`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load cards.");
  return (await res.json()) as CardsEnvelope;
}

export default async function InsightsPage() {
  const envelope = await load();
  return <InsightsDashboard envelope={envelope} />;
}
