"use client";

/**
 * One persistent header across every surface.
 *
 * Before this there were two navigations at the same level, a floating pill at
 * the bottom and the dashboard's own header, so nothing told you which was the
 * real one. A site has a header: wordmark, tabs, and the state that applies
 * everywhere, which here is which archive is loaded.
 */

import { usePathname } from "next/navigation";
import { useArchive } from "@/lib/useArchive";
import { ThemeToggle } from "./Theme";

const TABS = [
  { href: "/", label: "Find", hint: "Who has gone quiet" },
  { href: "/book", label: "Read", hint: "The archive as a book" },
  { href: "/wrapped", label: "Wrapped", hint: "Your year in DMs" },
  { href: "/insights", label: "Cards", hint: "Everything as a list" },
  { href: "/dm", label: "DM", hint: "The DM-style view" },
];

export function TopBar() {
  const path = usePathname();
  const { archive, checked } = useArchive();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <a
          href="/"
          className="shrink-0 font-serif text-[17px] leading-none text-bone sm:text-[20px]"
        >
          Insta Insights
        </a>

        {/* The four tabs plus the wordmark do not fit on a small phone, so the
            tab strip scrolls rather than pushing the page wider. */}
        <nav
          aria-label="Surfaces"
          className="-mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t) => {
            const active = path === t.href;
            return (
              <a
                key={t.href}
                href={t.href}
                title={t.hint}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 rounded-md px-2 py-1.5 text-[13px] transition-colors sm:px-3 ${
                  active ? "text-bone" : "text-faint hover:text-muted"
                }`}
              >
                {t.label}
                {active ? (
                  <span className="absolute inset-x-2 -bottom-[11px] h-[2px] rounded-full bg-ember sm:inset-x-3" />
                ) : null}
              </a>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {checked ? (
            archive.session ? (
              <span
                className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-faint sm:inline"
                title={`${archive.threadCount} conversations, ${archive.messageCount.toLocaleString()} messages`}
              >
                {archive.owner} · {archive.threadCount.toLocaleString()} chats
              </span>
            ) : (
              <a
                href="/"
                className="hidden rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint transition-colors hover:border-ember hover:text-bone sm:inline-block"
              >
                Sample · load yours
              </a>
            )
          ) : null}

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
