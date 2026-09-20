/** Exact display contract from CARDS_CONTRACT.md. No insight-generation types. */
export interface CardsEnvelope {
  generatedAt: string;
  owner: string;
  cards: Card[];
}

export interface FriendReference {
  name: string;
  threadId: string;
}

export interface Stat {
  label: string;
  value: string;
}

export interface Evidence {
  id: string;
  sender: string;
  isFromOwner: boolean;
  isKey: boolean;
  threadName: string;
  timestamp: string;
  text: string;
}

export interface CardAction {
  label: string;
  draft: string | null;
}

export interface Card {
  id: string;
  kind: string; // Intentionally open: future kinds use the same renderer.
  score: number;
  rank: number | null;
  friend: FriendReference;
  title: string;
  body: string;
  stats: Stat[];
  evidence: Evidence[];
  action: CardAction | null;
}

export function groupCards(cards: Card[]) {
  return {
    people: cards
      .filter((card) => card.kind === "your_people")
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)),
    feed: cards
      .filter((card) => card.kind !== "your_people")
      .sort((a, b) => b.score - a.score),
  };
}

// Explicit UTC keeps server/client dates identical; the UI labels this timezone.
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const time = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function displayDate(timestamp: string): string {
  return date.format(new Date(timestamp));
}

export function displayTime(timestamp: string): string {
  return time.format(new Date(timestamp));
}

/** A changed chat, calendar day, or 4-hour gap starts a separate exchange. */
export function startsExchange(
  current: Evidence,
  previous?: Evidence,
): boolean {
  return (
    !previous ||
    current.threadName !== previous.threadName ||
    current.timestamp.slice(0, 10) !== previous.timestamp.slice(0, 10) ||
    Math.abs(Date.parse(current.timestamp) - Date.parse(previous.timestamp)) >=
      4 * 3_600_000
  );
}

/** Share only supplied display text; never infer a draft for a null draft. */
export function shareText(card: Card): string {
  return [
    card.title,
    card.body,
    ...card.stats.map(({ label, value }) => `${label}: ${value}`),
  ].join("\n\n");
}
