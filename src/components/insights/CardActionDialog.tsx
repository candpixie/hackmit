"use client";

import { useEffect, useId, useRef, useState } from "react";
import { shareText, type Card } from "@/lib/cards";
import { ArrowIcon } from "./CardIcon";

export function CardActionDialog({ card }: { card: Card }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [draft, setDraft] = useState(card.action?.draft ?? "");
  const [feedback, setFeedback] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const action = card.action;

  useEffect(() => {
    if (!isOpen) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [isOpen]);

  if (!action) return null;
  const hasDraft = action.draft !== null;
  const text = hasDraft ? draft : shareText(card);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Copied to clipboard.");
    } catch {
      setFeedback(
        "Clipboard unavailable. Select the text and copy it manually.",
      );
    }
  }

  function open() {
    setFeedback("");
    dialog.current?.showModal();
    setIsOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex min-h-11 items-center justify-center gap-3 rounded-lg bg-bone px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-ember focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember"
      >
        {action.label}
        <ArrowIcon />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              event.currentTarget.close();
          }
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 text-bone backdrop:bg-black/75 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-ember">
              {card.friend.name}
            </p>
            <h2 id={`${id}-title`} className="mt-2 font-serif text-3xl">
              {hasDraft ? "Make it sound like you." : action.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close dialog"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-xl text-muted hover:text-bone focus-visible:outline-2 focus-visible:outline-ember"
          >
            ×
          </button>
        </div>
        <p
          id={`${id}-description`}
          className="mt-3 text-sm leading-relaxed text-muted"
        >
          {hasDraft
            ? "A starting point for your next conversation. Edit it, then copy when you're ready."
            : "Copy this recap to share wherever you like."}
        </p>
        {hasDraft ? (
          <div className="mt-6">
            <label
              htmlFor={`${id}-draft`}
              className="mb-2 block text-xs text-muted"
            >
              Your message
            </label>
            <textarea
              id={`${id}-draft`}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setFeedback("");
              }}
              rows={6}
              className="w-full resize-y rounded-xl border border-line bg-ink p-4 text-base leading-relaxed text-bone focus:border-ember focus:outline-none"
            />
          </div>
        ) : (
          <div
            tabIndex={0}
            aria-label="Share preview"
            className="mt-6 rounded-xl border border-line bg-ink p-4 text-sm leading-relaxed whitespace-pre-wrap break-words"
          >
            {text}
          </div>
        )}
        <p
          role="status"
          aria-live="polite"
          className="mt-3 min-h-5 text-xs text-sage"
        >
          {feedback}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copy}
            disabled={!text.trim()}
            className="min-h-11 rounded-lg bg-ember px-5 py-2.5 text-sm font-medium text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="min-h-11 rounded-lg border border-line px-5 py-2.5 text-sm text-muted hover:text-bone focus-visible:outline-2 focus-visible:outline-ember"
          >
            {hasDraft ? "Cancel" : "Close"}
          </button>
          {hasDraft ? (
            <a
              href="https://www.instagram.com/direct/inbox/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center px-1 text-xs text-muted underline underline-offset-4 hover:text-bone"
            >
              Open Instagram ↗
            </a>
          ) : null}
        </div>
        <p className="mt-5 text-[11px] text-muted">
          {hasDraft
            ? "Nothing is sent automatically. Instagram opens your inbox; choose the conversation yourself."
            : "Only the recap text and stats are copied. Source messages stay here."}
        </p>
      </dialog>
    </>
  );
}
