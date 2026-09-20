"use client";

/**
 * The dashboard reads the same card feed every other surface reads, from
 * whatever archive the session points at. It was a server component fetching
 * /api/cards with no session, which meant it always rendered the synthetic
 * corpus no matter what the person had loaded.
 */

import { useEffect, useState } from "react";
import type { CardsEnvelope } from "@/lib/cards";
import { InsightsDashboard } from "@/components/insights/InsightsDashboard";
import { useArchive } from "@/lib/useArchive";
import { Loading } from "@/components/Loading";

export default function InsightsPage() {
  const { archive, checked } = useArchive();
  const [envelope, setEnvelope] = useState<CardsEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;

    const url = archive.session
      ? `/api/cards?session=${encodeURIComponent(archive.session)}`
      : "/api/cards";

    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? "Could not load your insights.");
        return b as CardsEnvelope;
      })
      .then(setEnvelope)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed."));
  }, [checked, archive.session]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-[15px] text-ember">{error}</p>
      </main>
    );
  }

  if (!envelope) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <Loading stage="scoring" note="Reading your archive." />
      </main>
    );
  }

  return (
    <>
      <InsightsDashboard envelope={envelope} />
    </>
  );
}
