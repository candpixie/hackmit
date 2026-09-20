"use client";

/** Paper by default. The dark variant is kept for anyone who wants it. */

import { useEffect, useState } from "react";

const KEY = "overdue.theme";

export function ThemeToggle() {
  const [paper, setPaper] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY) === "paper";
    setPaper(saved);
    document.documentElement.dataset.theme = saved ? "paper" : "dark";
  }, []);

  function flip() {
    const next = !paper;
    setPaper(next);
    localStorage.setItem(KEY, next ? "paper" : "dark");
    document.documentElement.dataset.theme = next ? "paper" : "dark";
  }

  return (
    <button
      onClick={flip}
      aria-label={paper ? "Switch to dark" : "Switch to paper"}
      className="rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint transition-colors hover:text-bone"
    >
      {paper ? "Dark" : "Paper"}
    </button>
  );
}
