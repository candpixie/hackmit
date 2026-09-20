import type { Card } from "@/lib/cards";
import { CardActionDialog } from "./CardActionDialog";
import { CardIcon } from "./CardIcon";
import { EvidenceConversation } from "./EvidenceConversation";

const labels: Record<string, string> = {
  your_people: "Your people",
  memory_lane: "Memory lane",
  reconnect: "Reconnect",
  unfinished_plans: "Unfinished plans",
  unanswered: "Unanswered moments",
  both_wanted: "You both wanted this",
  recap: "Friendship recap",
};

/** One field-driven layout, including unknown kinds and ranked people cards. */
export function InsightCard({
  card,
  featured = false,
}: {
  card: Card;
  featured?: boolean;
}) {
  const label = Object.hasOwn(labels, card.kind)
    ? labels[card.kind]
    : card.kind.replace(/[_-]/g, " ");
  return (
    <article
      data-card-id={card.id}
      data-kind={card.kind}
      data-score={card.score}
      data-rank={card.rank ?? undefined}
      aria-label={card.title}
      className={`min-w-0 rounded-2xl border bg-card p-5 sm:p-6 ${featured ? "border-ember/45 lg:col-span-2" : "border-line"}`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.13em] ${featured ? "text-ember" : "text-muted"}`}
        >
          <CardIcon kind={card.kind} />
          {label || "Insight"}
        </span>
        {card.rank !== null ? (
          <span
            className="font-mono text-xs text-ember"
            aria-label={`Rank ${card.rank}`}
          >
            No. {String(card.rank).padStart(2, "0")}
          </span>
        ) : featured ? (
          <span className="rounded-full bg-ember/10 px-2.5 py-1 text-[10px] text-ember">
            Worth a little attention
          </span>
        ) : null}
      </div>
      <div
        className={
          featured ? "grid min-w-0 gap-7 md:grid-cols-2 md:gap-10" : "min-w-0"
        }
      >
        <div className="flex min-w-0 flex-col items-start">
          {card.title !== card.friend.name ? (
            <p className="mb-2 text-xs text-muted">With {card.friend.name}</p>
          ) : null}
          <h3
            className={`font-serif leading-[1.12] break-words text-bone ${featured ? "text-[34px] sm:text-[38px]" : "text-[27px]"}`}
          >
            {card.title}
          </h3>
          <p className="mt-3 text-[13px] leading-[1.8] text-muted">
            {card.body}
          </p>
          {card.stats.length ? (
            <dl
              data-stats
              className="mt-5 grid w-full grid-cols-2 gap-x-5 gap-y-4 border-t border-line pt-5"
            >
              {card.stats.map((stat, index) => (
                <div key={`${stat.label}:${index}`} className="min-w-0">
                  <dt className="text-[10px] leading-relaxed text-muted">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 break-words text-[13px] leading-relaxed text-bone">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {card.evidence.length ? (
          <div
            className={
              featured
                ? "min-w-0 md:col-start-2 md:row-start-1 md:row-span-2"
                : "mt-6 min-w-0"
            }
          >
            <EvidenceConversation evidence={card.evidence} />
          </div>
        ) : null}
        {card.action ? (
          <div
            className={
              featured ? "md:col-start-1 md:row-start-2 md:self-end" : "mt-6"
            }
          >
            <CardActionDialog card={card} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
