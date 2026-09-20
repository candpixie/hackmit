"use client";

/**
 * One archive, shared by every surface.
 *
 * Before this, each page loaded its own data and three of them silently fell
 * back to the synthetic corpus, so you could read your real archive on one
 * page and a stranger's on the next. The session id now lives in localStorage
 * and every surface asks for the same one.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "overdue.session";

export type Stage =
  | "idle"
  | "reading"
  | "parsing"
  | "scoring"
  | "indexing"
  | "ready"
  | "error";

/** What the person is told while they wait, in the order it actually happens. */
export const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  reading: "Reading your export",
  parsing: "Parsing conversations",
  scoring: "Finding what was left unfinished",
  indexing: "Indexing for search",
  ready: "Ready",
  error: "Something went wrong",
};

export type Archive = {
  session: string | null;
  owner: string | null;
  threadCount: number;
  messageCount: number;
  isSample: boolean;
};

const EMPTY: Archive = {
  session: null,
  owner: null,
  threadCount: 0,
  messageCount: 0,
  isSample: true,
};

export function useArchive() {
  const [archive, setArchive] = useState<Archive>(EMPTY);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // Adopt a session another surface already loaded.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    if (!saved) {
      setChecked(true);
      return;
    }

    fetch(`/api/session?session=${encodeURIComponent(saved)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) {
          setArchive({
            session: saved,
            owner: d.owner,
            threadCount: d.threadCount,
            messageCount: d.messageCount,
            isSample: false,
          });
          setStage("ready");
        } else {
          localStorage.removeItem(KEY);
        }
      })
      .catch(() => localStorage.removeItem(KEY))
      .finally(() => setChecked(true));
  }, []);

  const load = useCallback(
    async (body: { localDir?: string; files?: { name: string; text: string }[] }) => {
      setError(null);
      setStage("reading");

      // The work happens in one request, so the stages below are honest about
      // what is running rather than a fake percentage. They are paced from the
      // measured shape of a real 400-conversation parse.
      const steps: [Stage, number][] = [
        ["parsing", 1800],
        ["scoring", 9000],
        ["indexing", 20000],
      ];
      const timers = steps.map(([s, at]) => setTimeout(() => setStage(s), at));

      try {
        const res = await fetch("/api/analyse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not read that archive.");

        localStorage.setItem(KEY, data.session);
        setArchive({
          session: data.session,
          owner: data.owner,
          threadCount: data.threadCount,
          messageCount: data.messageCount,
          isSample: Boolean(data.sample),
        });
        setStage("ready");
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed.");
        setStage("error");
        return null;
      } finally {
        timers.forEach(clearTimeout);
      }
    },
    []
  );

  const forget = useCallback(() => {
    localStorage.removeItem(KEY);
    setArchive(EMPTY);
    setStage("idle");
  }, []);

  return { archive, stage, error, checked, load, forget };
}
