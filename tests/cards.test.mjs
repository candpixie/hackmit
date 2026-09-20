import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  groupCards,
  startsExchange,
  shareText,
  displayDate,
  displayTime,
} from "../src/lib/cards.ts";

const envelope = JSON.parse(
  readFileSync(new URL("../cards.example.json", import.meta.url), "utf8"),
);

test("every supplied card survives grouping, without mutating the envelope", () => {
  const before = JSON.stringify(envelope);
  const { people, feed } = groupCards(envelope.cards);
  assert.equal(people.length, 3);
  assert.equal(feed.length, 6);
  assert.deepEqual(
    [...people, ...feed].map((c) => c.id).sort(),
    envelope.cards.map((c) => c.id).sort(),
  );
  assert.equal(JSON.stringify(envelope), before);
});

test("rank and score order do not depend on incoming JSON order", () => {
  const { people, feed } = groupCards([...envelope.cards].reverse());
  assert.deepEqual(
    people.map((c) => c.rank),
    [1, 2, 3],
  );
  assert.deepEqual(
    feed.map((c) => c.score),
    [0.91, 0.88, 0.86, 0.8, 0.75, 0.7],
  );
});

test("unknown future kinds stay in the feed and keep their fields", () => {
  const future = {
    ...envelope.cards[0],
    id: "future",
    kind: "future_kind",
    rank: null,
    score: 1,
    stats: [],
    evidence: [],
    action: null,
  };
  const { feed } = groupCards([future, ...envelope.cards]);
  assert.equal(feed[0], future);
  assert.equal(feed.length, 7);
});

test("empty collections and absent people rank are safe", () => {
  assert.deepEqual(groupCards([]), { people: [], feed: [] });
  const missingRank = { ...envelope.cards[0], id: "unranked", rank: null };
  assert.equal(
    groupCards([missingRank, envelope.cards[0]]).people.at(-1).id,
    "unranked",
  );
});

test("continuous memory messages stay together", () => {
  const { evidence } = envelope.cards.find((c) => c.kind === "memory_lane");
  assert.equal(startsExchange(evidence[0]), true);
  for (let i = 1; i < evidence.length; i++)
    assert.equal(startsExchange(evidence[i], evidence[i - 1]), false);
});

test("separate dates and separate chats are never presented as one exchange", () => {
  for (const kind of ["unfinished_plans", "reconnect", "both_wanted"]) {
    const { evidence } = envelope.cards.find((c) => c.kind === kind);
    for (let i = 1; i < evidence.length; i++)
      assert.equal(startsExchange(evidence[i], evidence[i - 1]), true);
  }
  const message = envelope.cards.find((c) => c.kind === "both_wanted")
    .evidence[0];
  assert.equal(
    startsExchange({ ...message, threadName: "Another chat" }, message),
    true,
  );
  assert.equal(
    startsExchange({ ...message, timestamp: "2025-03-02T23:00:00Z" }, message),
    true,
  );
});

test("sharing a null-draft action uses supplied recap text and stats only", () => {
  const recap = envelope.cards.find((c) => c.kind === "recap");
  assert.equal(recap.action.draft, null);
  assert.equal(
    shareText(recap),
    [
      recap.title,
      recap.body,
      ...recap.stats.map((s) => `${s.label}: ${s.value}`),
    ].join("\n\n"),
  );
  assert.ok(!shareText(recap).includes(recap.evidence[0].text));
});

test("date formatting is explicitly UTC, including near-midnight messages", () => {
  assert.equal(displayDate("2024-09-03T01:12:00Z"), "Sep 3, 2024");
  assert.equal(displayTime("2024-09-03T01:12:00Z"), "1:12 AM");
});
