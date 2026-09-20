"use client";

import { useRef, useState } from "react";
import { Loading } from "./Loading";
import type { Stage } from "@/lib/useArchive";
import Link from "next/link";

type Props = {
  onLoad: (files: { name: string; text: string }[] | null) => void;
  onLoadDir: (dir: string) => void;
  busy: boolean;
  stage: Stage;
  error: string | null;
};

export function Landing({ onLoad, onLoadDir, busy, stage, error }: Props) {
  // Prefilled: nobody should be typing a path correctly during a demo.
  const [dir, setDir] = useState("~/Downloads/inbox");
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function take(list: FileList | null) {
    if (!list?.length) return;
    const files = await Promise.all(
      [...list]
        .filter((f) => f.name.endsWith(".txt"))
        .map(async (f) => ({ name: f.name, text: await f.text() }))
    );
    if (files.length) onLoad(files);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
      <div className="rise">
        <Link href="/insights" className="mb-8 inline-flex rounded-full border border-line px-4 py-2 text-[13px] text-muted transition-colors hover:border-ember hover:text-bone">
          Preview the Insights dashboard →
        </Link>
        <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.22em] text-faint">
          Overdue
        </p>

        <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-bone sm:text-6xl">
          You have friendships
          <br />
          you are about to lose.
        </h1>

        <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-muted">
          Not the ones you argued with. The ones that just went quiet while you were
          busy. Give Overdue your chat history and it will find them, tell you exactly
          what was left unfinished, and write the one message that reopens it.
        </p>

        {busy ? (
          <div className="mt-12 rounded-xl border border-line bg-ink-soft p-10">
            <Loading
              stage={stage === "idle" ? "reading" : stage}
              note="Four hundred conversations takes about half a minute. Nothing is uploaded, this is all happening on your machine."
            />
          </div>
        ) : (
          <>
        <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void take(e.dataTransfer.files);
            }}
            className={`mt-12 rounded-xl border border-dashed p-10 text-center transition-colors ${
              over ? "border-ember bg-ember/5" : "border-line bg-ink-soft"
            }`}
          >
            <p className="text-[15px] text-bone">Drop your WhatsApp exports here</p>
            <p className="mt-2 text-[13px] leading-relaxed text-faint">
              Open a chat → Export Chat → Without Media. Any number of <code>.txt</code>{" "}
              files.
            </p>
  
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => input.current?.click()}
                disabled={busy}
                className="rounded-md bg-bone px-5 py-2.5 text-[14px] font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Choose files
              </button>
              <button
                onClick={() => onLoad(null)}
                disabled={busy}
                className="rounded-md border border-line px-5 py-2.5 text-[14px] text-muted transition-colors hover:border-faint hover:text-bone disabled:opacity-50"
              >
                {busy ? "Reading…" : "Use the sample archive"}
              </button>
            </div>
  
            <input
              ref={input}
              type="file"
              accept=".txt"
              multiple
              hidden
              onChange={(e) => void take(e.target.files)}
            />
          </div>
  
          <div className="mt-6 rounded-xl border border-line bg-ink-soft p-6">
            <p className="text-[14px] text-bone">Or point it at an Instagram export</p>
            <p className="mt-2 text-[13px] leading-relaxed text-faint">
              Instagram → Your activity → Download your information → HTML. Give it the
              path to the <code>inbox</code> folder.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <input
                value={dir}
                onChange={(e) => setDir(e.target.value)}
                placeholder="~/Downloads/inbox"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-md border border-line bg-card px-4 py-2.5 font-mono text-[13px] text-bone placeholder:text-faint"
              />
              <button
                onClick={() => dir.trim() && onLoadDir(dir.trim())}
                disabled={busy || !dir.trim()}
                className="rounded-md border border-line px-5 py-2.5 text-[14px] text-muted transition-colors hover:border-ember hover:text-bone disabled:opacity-40"
              >
                Read it
              </button>
            </div>
          </div>
  
            </>
        )}

        {error ? (
          <p className="mt-5 text-[13px] text-ember">{error}</p>
        ) : (
          <p className="mt-5 text-[13px] leading-relaxed text-faint">
            Your messages are parsed for this session and never stored. Nothing is
            written to disk, and nothing leaves the page until you ask for a draft.
          </p>
        )}
      </div>
    </main>
  );
}
