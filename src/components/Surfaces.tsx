"use client";

/**
 * One archive, four ways to read it. Shown on every surface so they are
 * alternatives rather than separate products.
 */

import { usePathname } from "next/navigation";

const SURFACES = [
  { href: "/", label: "Act" },
  { href: "/book", label: "Read" },
  { href: "/wrapped", label: "Wrapped" },
  { href: "/insights", label: "List" },
];

export function Surfaces() {
  const path = usePathname();

  return (
    <nav className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <ul className="flex items-center gap-1 rounded-full border border-line bg-ink-soft/90 px-1.5 py-1.5 backdrop-blur">
        {SURFACES.map((s) => {
          const active = path === s.href;
          return (
            <li key={s.href}>
              <a
                href={s.href}
                className={`block rounded-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                  active ? "bg-bone text-ink" : "text-faint hover:text-bone"
                }`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
