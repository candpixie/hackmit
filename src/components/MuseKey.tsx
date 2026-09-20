"use client";

/**
 * Bring your own Muse key.
 *
 * Signing in with Meta properly needs a registered OAuth client, which is a
 * review process rather than an afternoon. This gets the part that actually
 * matters: the person's drafts run on their own Muse account and their own
 * credits, not ours.
 *
 * The key lives in this browser. It is sent per request and never written to
 * the server, never logged, and never persisted anywhere we control.
 */

import { useEffect, useState } from "react";

const KEY = "overdue.museKey";

export function getMuseKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Header the API routes read before falling back to the server's own key. */
export function museHeaders(): Record<string, string> {
  const k = getMuseKey();
  return k ? { "x-muse-key": k } : {};
}

export function MuseKeyPanel() {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => setSaved(getMuseKey()), []);

  function save() {
    const v = value.trim();
    if (!v) return;
    localStorage.setItem(KEY, v);
    setSaved(v);
    setValue("");
    setOpen(false);
  }

  function clear() {
    localStorage.removeItem(KEY);
    setSaved(null);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint transition-colors hover:text-bone"
      >
        {saved ? "Using your Muse key" : "Use your own Muse key"}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          Your Muse key
        </p>
        <button
          onClick={() => setOpen(false)}
          className="font-mono text-[10px] text-faint hover:text-bone"
        >
          Close
        </button>
      </div>

      {saved ? (
        <div className="mt-4">
          <p className="font-mono text-[12px] text-bone">
            {saved.slice(0, 8)}
            <span className="text-faint">{"…".repeat(3)}</span>
            {saved.slice(-4)}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-faint">
            Drafts run on your account. Stored in this browser only.
          </p>
          <button
            onClick={clear}
            className="mt-4 rounded-md border border-line px-4 py-2 text-[13px] text-muted transition-colors hover:border-ember hover:text-bone"
          >
            Remove it
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            Run <code className="text-muted">muse login</code>, then paste the key. It
            stays in this browser, is sent with each request, and is never stored on
            our side.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="LLM|…"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-md border border-line bg-ink-soft px-3 py-2 font-mono text-[12px] text-bone placeholder:text-faint"
            />
            <button
              onClick={save}
              disabled={!value.trim()}
              className="rounded-md bg-bone px-4 py-2 text-[13px] font-medium text-ink disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </>
      )}
    </div>
  );
}
