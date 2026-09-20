import { withoutEmoji } from "@/lib/display-text";
import { Fragment } from "react";
import {
  displayDate,
  displayTime,
  startsExchange,
  type Evidence,
} from "@/lib/cards";

export function EvidenceConversation({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null;
  const crossThread =
    new Set(evidence.map((message) => message.threadName)).size > 1;

  return (
    <section
      aria-label="Messages behind this insight"
      data-evidence
      className="min-w-0 rounded-xl border border-line bg-ink/60 p-4 sm:p-5"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-[13px] uppercase tracking-[0.15em] text-muted">
        <span>From your conversations</span>
        <span className="normal-case tracking-normal">Times in UTC</span>
      </div>
      <div className="space-y-3">
        {evidence.map((message, index) => (
          <Fragment key={`${message.threadName}:${message.id}:${index}`}>
            {startsExchange(message, evidence[index - 1]) ? (
              <div
                data-date-separator
                className="flex items-center gap-3 py-2 text-center text-[13px] text-muted"
              >
                <span className="h-px flex-1 bg-line" />
                <time dateTime={message.timestamp}>
                  {displayDate(message.timestamp)}
                  {index > 0 &&
                  message.timestamp.slice(0, 10) ===
                    evidence[index - 1].timestamp.slice(0, 10)
                    ? ` · ${displayTime(message.timestamp)}`
                    : ""}
                </time>
                <span className="h-px flex-1 bg-line" />
              </div>
            ) : null}
            <div
              data-owner={message.isFromOwner}
              data-key={message.isKey}
              className={`flex ${message.isFromOwner ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] min-w-0 sm:max-w-[88%] ${message.isFromOwner ? "text-right" : "text-left"}`}
              >
                <div
                  className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted"
                  style={{
                    justifyContent: message.isFromOwner
                      ? "flex-end"
                      : "flex-start",
                  }}
                >
                  <span>{message.sender}</span>
                  {message.isKey ? (
                    <span className="font-medium text-ember">Key message</span>
                  ) : null}
                </div>
                {crossThread ? (
                  <p className="mb-1.5 break-words text-[13px] text-muted">
                    In chat with {message.threadName}
                  </p>
                ) : null}
                <blockquote
                  className={`rounded-2xl border px-3.5 py-3 text-left text-[16px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${message.isFromOwner ? "rounded-br-sm bg-ember/10" : "rounded-bl-sm bg-card"} ${message.isKey ? "border-ember/45 text-bone" : "border-line text-muted"}`}
                >
                  {withoutEmoji(message.text)}
                </blockquote>
                <time
                  dateTime={message.timestamp}
                  className="mt-1.5 block text-[13px] text-muted"
                >
                  {displayTime(message.timestamp)}
                </time>
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
