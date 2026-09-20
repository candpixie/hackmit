"use client";

import { useCallback, useState } from "react";
import type { Report, TieView } from "@/lib/types";
import { Landing } from "@/components/Landing";
import { Ranking } from "@/components/Ranking";
import { Detail } from "@/components/Detail";
import { Friendsgiving } from "@/components/Friendsgiving";
import { Closest } from "@/components/Closest";

export default function Page() {
  const [report, setReport] = useState<Report | null>(null);
  const [selected, setSelected] = useState<TieView | null>(null);
  const [group, setGroup] = useState(false);
  const [closest, setClosest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (body: object | null) => {
    setBusy(true);
    setError(null);
    try {
      const res = body
        ? await fetch("/api/analyse", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/analyse");

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read those exports.");

      setReport(data as Report);
      setSelected((data as Report).ties[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  const load = useCallback(
    (files: { name: string; text: string }[] | null) => run(files ? { files } : null),
    [run]
  );

  const loadDir = useCallback((localDir: string) => run({ localDir }), [run]);

  if (!report) {
    return <Landing onLoad={load} onLoadDir={loadDir} busy={busy} error={error} />;
  }

  if (group) {
    return <Friendsgiving report={report} onBack={() => setGroup(false)} />;
  }

  if (closest) {
    return <Closest report={report} onBack={() => setClosest(false)} />;
  }

  return (
    <main className="mx-auto grid max-w-[1400px] gap-10 px-6 py-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:px-10">
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
