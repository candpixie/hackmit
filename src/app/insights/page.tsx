import type { Metadata } from "next";
import example from "../../../cards.example.json";
import type { CardsEnvelope } from "@/lib/cards";
import { InsightsDashboard } from "@/components/insights/InsightsDashboard";

export const metadata: Metadata = {
  title: "Insights · Your conversations, rediscovered",
  description:
    "The people, memories, and plans tucked inside your conversations.",
};

// Replace this data source with the API response later; the renderer stays the same.
const envelope: CardsEnvelope = example;

export default function InsightsPage() {
  return <InsightsDashboard envelope={envelope} />;
}
