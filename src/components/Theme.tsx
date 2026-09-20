"use client";

/** Paper by default. The dark variant is kept for anyone who wants it. */

import { useEffect, useState } from "react";

const KEY = "overdue.theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY) === "dark";
    setDark(saved);
    document.documentElement.dataset.theme = saved ? "dark" : "paper";
  }, []);

  function flip() {
    const next = !dark;
    setDark(next);
    localStorage.setItem(KEY, next ? "dark" : "paper");
    document.documentElement.dataset.theme = next ? "dark" : "paper";
  }

  return (
    <button
      onClick={flip}
      aria-label={dark ? "Switch to paper" : "Switch to dark"}
      className="rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint transition-colors hover:text-bone"
    >
      {dark ? "Paper" : "Dark"}
    </button>
  );
}
