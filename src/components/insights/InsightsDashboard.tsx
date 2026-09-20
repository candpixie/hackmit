import Link from "next/link";
import { displayDate, groupCards, type CardsEnvelope } from "@/lib/cards";
import { InsightCard } from "./InsightCard";

export function InsightsDashboard({ envelope }: { envelope: CardsEnvelope }) {
  const { people, feed } = groupCards(envelope.cards);
  return (
    <div className="mx-auto max-w-[1180px] px-5 sm:px-8 lg:px-12">
      <a
        href="#insights-content"
        className="sr-only z-50 rounded bg-bone p-3 text-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to insights
      </a>
      <main id="insights-content" className="pb-16">
        <div className="flex flex-col justify-between gap-6 pt-11 pb-10 sm:flex-row sm:items-end sm:pt-14 sm:pb-12">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ember">
              A little history. A new conversation.
            </p>
            <h1 className="mt-4 max-w-xl font-serif text-[42px] leading-[1.02] tracking-tight text-bone sm:text-[56px]">
              Some things are
              <br />
              worth coming back to.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted">
              The people, little moments, and unfinished plans
              <br className="hidden sm:block" /> tucked inside your
              conversations.
            </p>
          </div>
          <div className="shrink-0 text-xs leading-relaxed text-muted sm:pb-1 sm:text-right">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              Sample archive
            </span>
            <p>
              Archive owner: <span className="text-bone">{envelope.owner}</span>
            </p>
            <p className="mt-1">
              Generated{" "}
              <time dateTime={envelope.generatedAt}>
                {displayDate(envelope.generatedAt)}
              </time>{" "}
              · UTC
            </p>
          </div>
        </div>
        {people.length ? (
          <section
            id="your-people"
            aria-labelledby="people-title"
            className="scroll-mt-6"
          >
            <div className="mb-5 flex items-baseline gap-4">
              <h2 id="people-title" className="font-serif text-[28px]">
                Your people
              </h2>
              <span className="text-[11px] text-muted">
                The familiar names in your story
              </span>
            </div>
            <div className="grid items-start gap-4 md:grid-cols-3">
              {people.map((card) => (
                <InsightCard key={card.id} card={card} />
              ))}
            </div>
          </section>
        ) : null}
        {feed.length ? (
          <section
            id="insights-feed"
            aria-labelledby="feed-title"
            className="mt-12 scroll-mt-6 sm:mt-14"
          >
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="feed-title" className="font-serif text-[28px]">
                A few things you might have missed
              </h2>
              <span className="text-[11px] text-muted">
                Strongest insights first
              </span>
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-2">
              {feed.map((card, index) => (
                <InsightCard key={card.id} card={card} featured={index === 0} />
              ))}
            </div>
          </section>
        ) : null}
        {!envelope.cards.length ? (
          <p className="border-t border-line py-12 text-muted">
            No cards in this archive yet.
          </p>
        ) : null}
      </main>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-line py-6 text-[11px] text-muted">
        <span>Insights · Made for the people in your life.</span>
        <span>Your words. Your next move.</span>
      </footer>
    </div>
  );
}
