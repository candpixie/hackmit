"use client";

import { useCallback, useState } from "react";
import type { Report, TieView } from "@/lib/types";
import { Landing } from "@/components/Landing";
import { Ranking } from "@/components/Ranking";
import { Detail } from "@/components/Detail";
import { Friendsgiving } from "@/components/Friendsgiving";
import { Closest } from "@/components/Closest";
import { useArchive } from "@/lib/useArchive";

export default function Page() {
  const [report, setReport] = useState<Report | null>(null);
  const [selected, setSelected] = useState<TieView | null>(null);
  const [group, setGroup] = useState(false);
  const [closest, setClosest] = useState(false);
  const { stage, error: loadError, load: loadArchive } = useArchive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (body: object | null) => {
      setBusy(true);
      setError(null);
      try {
        // Going through the shared loader is what publishes the session id the
        // other surfaces read, so they stop falling back to the sample.
        if (body) {
          const data = await loadArchive(body as { localDir?: string });
          if (!data) return;
          setReport(data as Report);
          setSelected((data as Report).ties[0] ?? null);
          return;
        }

        const res = await fetch("/api/analyse");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not read those exports.");
        setReport(data as Report);
        setSelected((data as Report).ties[0] ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [loadArchive]
  );

  const load = useCallback(
    (files: { name: string; text: string }[] | null) => run(files ? { files } : null),
    [run]
  );

  const loadDir = useCallback((localDir: string) => run({ localDir }), [run]);

  if (!report) {
    return (
      <Landing
        onLoad={load}
        onLoadDir={loadDir}
        busy={busy}
        stage={stage}
        error={error ?? loadError}
      />
    );
  }

  if (group) {
    return <Friendsgiving report={report} onBack={() => setGroup(false)} />;
  }

  if (closest) {
    return <Closest report={report} onBack={() => setClosest(false)} />;
  }

  return (
    <main className="mx-auto grid max-w-[var(--w-page)] gap-10 px-6 py-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:px-10">
      <Ranking
        report={report}
        selected={selected}
        onSelect={setSelected}
        onGroup={() => setGroup(true)}
        onClosest={() => setClosest(true)}
        onReset={() => {
          setReport(null);
          setSelected(null);
        }}
      />
      {selected ? <Detail tie={selected} owner={report.owner} session={report.session} /> : null}
    </main>
  );
}
