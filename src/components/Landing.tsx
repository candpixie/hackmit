"use client";

/**
 * The first screen.
 *
 * It used to be a headline over two grey boxes, which said nothing about what
 * the product finds and looked unfinished next to every other surface. It now
 * shows the three signals with a real example of each, because the fastest way
 * to explain this is to let someone read one of the things it pulls out.
 *
 * The loading state replaces the panel rather than sitting under it: while you
 * are waiting, the wait is the screen.
 */

import { useRef, useState } from "react";
import { Loading } from "./Loading";
import { MuseKeyPanel } from "./MuseKey";
import type { Stage } from "@/lib/useArchive";

type Props = {
  onLoad: (files: { name: string; text: string }[] | null) => void;
  onLoadDir: (dir: string) => void;
  busy: boolean;
  stage: Stage;
  error: string | null;
};

/** Real output, from the synthetic archive that ships with the repo. */
const SIGNALS = [
  {
    kind: "Unanswered",
    quote: "how did the showcase go?? you never told me",
    note: "Asked 437 days ago. You kept talking. You never answered it.",
  },
  {
    kind: "Never happened",
    quote: "next time you're home let's finally do the ceramics thing",
    note: "Raised 3 separate times. Never booked.",
  },
  {
    kind: "They wanted",
    quote: "i've always wanted to try ceramics, there's a studio two streets from me",
    note: "Said once, in passing, never followed up on.",
  },
];

export function Landing({ onLoad, onLoadDir, busy, stage, error }: Props) {
  // Prefilled: nobody should be typing a path correctly during a demo.
  const [dir, setDir] = useState("~/Downloads/inbox");
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [showPaths, setShowPaths] = useState(false);

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
    <main
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
      className={`min-h-[calc(100vh-3.5rem)] transition-colors ${
        over ? "bg-ember/[0.04]" : ""
      }`}
    >
      <div className="mx-auto grid max-w-[var(--w-page)] gap-16 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-20 lg:py-24">
        {/* the argument */}
        <div className="rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
            2026 · your year in DMs
          </p>

          <h1 className="mt-7 font-serif text-[52px] leading-[0.98] tracking-tight text-bone sm:text-[64px] lg:text-[72px]">
            You have friendships
            <br />
            you are about to lose.
          </h1>

          <p className="mt-8 max-w-lg text-[17px] leading-relaxed text-muted">
            Not the ones you argued with. The ones that went quiet while you were
            busy. Insta Insights reads your own messages and finds what was left
            unfinished in each one.
          </p>

          {/* show, do not describe */}
          <ul className="mt-12 space-y-px overflow-hidden rounded-lg border border-line">
            {SIGNALS.map((s) => (
              <li key={s.kind} className="bg-card px-6 py-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ember">
                  {s.kind}
                </p>
                <p className="mt-2.5 font-serif text-[17px] leading-snug text-bone">
                  “{s.quote}”
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-faint">{s.note}</p>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-[13px] leading-relaxed text-faint">
            Every one of them points at the message it came from, so you can check
            any of it.
          </p>
        </div>

        {/* the door */}
        <div className="lg:pt-[4.5rem]">
          <div className="rounded-xl border border-line bg-card p-8">
            {busy ? (
              <Loading
                stage={stage === "idle" ? "reading" : stage}
                note="Four hundred conversations takes about half a minute. Nothing is uploaded, this is happening on your machine."
              />
            ) : (
              <>
                <h2 className="font-serif text-[26px] leading-tight text-bone">
                  Read your archive.
                </h2>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  Nothing is uploaded. It is parsed here, on this machine.
                </p>

                <button
                  onClick={() => onLoad(null)}
                  className="mt-7 w-full rounded-md bg-ember px-5 py-3.5 text-[15px] font-medium text-ink transition-opacity hover:opacity-90"
                >
                  Try the sample archive
                </button>
                <p className="mt-2.5 text-center text-[11px] text-faint">
                  Fake conversations, every feature working. No export needed.
                </p>

                <div className="my-7 flex items-center gap-4">
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                    or your own
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => input.current?.click()}
                    className="w-full rounded-md border border-line px-5 py-3 text-left transition-colors hover:border-ember"
                  >
                    <span className="text-[13px] text-bone">WhatsApp</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-faint">
                      Export Chat → Without Media. Choose the .txt, or drop it
                      anywhere on this page.
                    </span>
                  </button>

                  <div className="rounded-md border border-line px-5 py-3">
                    <p className="text-[13px] text-bone">Instagram</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-faint">
                      Your activity → Download your information → HTML. Give it the
                      path to the <code>inbox</code> folder.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        value={dir}
                        onChange={(e) => setDir(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && dir.trim() && onLoadDir(dir.trim())
                        }
                        spellCheck={false}
                        className="w-full min-w-0 flex-1 rounded border border-line bg-ink-soft px-3 py-2 font-mono text-[11px] text-bone sm:w-auto"
                      />
                      <button
                        onClick={() => dir.trim() && onLoadDir(dir.trim())}
                        disabled={!dir.trim()}
                        className="rounded bg-bone px-4 py-2 text-[13px] font-medium text-ink disabled:opacity-40"
                      >
                        Read it
                      </button>
                    </div>
                  </div>
                </div>

                <input
                  ref={input}
                  type="file"
                  accept=".txt"
                  multiple
                  hidden
                  onChange={(e) => void take(e.target.files)}
                />

                {error ? <p className="mt-5 text-[13px] text-ember">{error}</p> : null}

                <div className="mt-7 border-t border-line pt-5">
                  <button
                    onClick={() => setShowPaths((v) => !v)}
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-bone"
                  >
                    Where your messages go
                  </button>
                  {showPaths ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-faint">
                      Parsed on this machine, never written to disk. If search is
                      configured they are indexed in your own Elasticsearch under a
                      random session id. Asking for a draft sends the few quoted
                      messages to the model. Nothing else leaves.
                    </p>
                  ) : null}
                  <div className="mt-4">
                    <MuseKeyPanel />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
