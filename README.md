# Overdue

**The friendships you're about to lose, and the one message that gets them back.**

Drop in your WhatsApp exports. Overdue finds the friendships that went quiet
while you were busy, shows you exactly what was left unfinished in each one,
writes the message that reopens it, and gets the whole group back in a room.

---

## The problem

Nobody loses friends in a fight. They lose them to a year of being busy. And by
the time you notice, the thing that would fix it, the specific unfinished thread
you could pick back up, is buried under four thousand messages you will never
scroll through.

So you send "hey stranger, long time no see," which says nothing, and they send
one back, and it dies again.

## What it actually finds

Four signals, all of them things you cannot find by scrolling:

**Decay** — who you used to talk to daily and haven't in three hundred days.
Scored against that friendship's own rhythm rather than a global constant, so a
pair who always texted monthly are not flagged for texting monthly.

**Unanswered** — they asked you something and you never answered it. Not "you
stopped replying": you *kept talking* and never came back to the question. Found
by comparing content words between their question and everything you said in the
fortnight after it. This is the one that hurts, and it is the one nobody finds
on their own.

**Never happened** — "we should do that pottery class," said once, never done.
Requires both a commitment and an activity, because in a student or work chat
almost every "we need to" is logistics.

**They wanted** — things they mentioned wanting, months apart, in passing.

Every signal carries the message ids it came from. Nothing in the interface
makes a claim it cannot point at, and when the model writes a draft it
highlights the exact messages it used. No invented compatibility scores.

## Three stages

1. **The list.** Every thread ranked by how worth rescuing it is. Warm
   friendships are shown and deliberately not flagged, so the ranking is
   falsifiable rather than a mood.
2. **The message.** One friend, their unfinished threads, and a draft that opens
   on the specific thing rather than on the silence.
3. **Friendsgiving.** Pick the group. Overdue searches every thread at once for
   what each person said they wanted, proposes plans the evidence supports,
   names what would rule each one out, and takes it through checkout with a
   spend cap.

---

## How the sponsors' pieces fit

**Meta / Muse.** Muse Spark (`muse-spark-1.3`) writes the reconnection drafts
and does the group synthesis: five people's scattered threads in, one plan
everyone would actually enjoy out, with the message behind each person's
inclusion quoted. Citations that do not point at a supplied message are dropped
before the response is returned, so the model cannot invent a memory.

**Elastic.** One archive fits in a loop. A real one does not, and the questions
worth asking are search questions. Elasticsearch stores every message with the
engine's own classification flags, which turns the question and commitment
patterns into filters instead of scans. It retrieves candidates across the whole
archive at once, aggregates cadence as a date histogram, and answers the
cross-thread question the group planner depends on: who has ever mentioned
wanting this. No per-thread loop can answer that.

**Visa.** Checkout follows scoped-credential agent commerce. The agent never
holds an open instrument: it gets one merchant, one amount, one thirty minute
window, and it has to show the human the cart and its reasoning before anything
moves. When the total exceeds the per person cap it changes the order and says
which line it dropped, rather than quietly overspending. Sandbox throughout, and
labelled as such, because a demo that claims a real payment is a demo that lies.

---

## Your data

Exports are parsed in memory for the length of a session. Nothing is written to
disk. The repo ships a synthetic corpus so the tests and the public demo never
contain a real person's messages, and `data/private/` is gitignored for your own
exports.

When Elasticsearch is configured, messages are indexed under a random session id
that scopes every later query, so two people on one cluster never see each
other's archives.

## Run it

```bash
pnpm install
pnpm corpus     # generate the synthetic archive
pnpm analyse    # prove the engine in a terminal, no keys needed
pnpm dev
```

`pnpm analyse data/private` runs the same engine over your own exports.

Everything works with no keys at all: drafting falls back to a grounded template
and the group planner is the only feature that needs a cluster. To turn the rest
on, copy `.env.example` to `.env.local`:

```bash
META_API_KEY=            # Muse. Drafting and group synthesis.
LLM_BASE_URL=https://api.meta.ai/v1
LLM_MODEL=muse-spark-1.3

ELASTIC_URL=             # Cross-thread search. Enables Friendsgiving.
ELASTIC_API_KEY=
```

The model client is OpenAI-compatible, so any compatible endpoint works.

## Getting your exports

WhatsApp, open a chat, tap the contact name, **Export Chat**, **Without Media**.
You get a `.txt`, or a `.zip` containing one. Drag it onto the page, or drop it
in `data/private/`.

The parser handles both iOS date formats and the Android format, works out
whether the file is day-first or month-first from the file as a whole, folds
wrapped lines back into their message, and strips the annotations WhatsApp
writes into message bodies.

## Layout

```
src/lib/parse.ts        WhatsApp export formats
src/lib/signals.ts      decay scoring and the four evidence types
src/lib/elastic.ts      indexing, cross-thread retrieval, aggregations
src/app/api/analyse     parse, score, index
src/app/api/draft       one reconnection message, grounded
src/app/api/plan        group synthesis over search results
src/app/api/checkout    scoped-credential agentic checkout, sandbox
scripts/make-corpus.ts  deterministic synthetic archive
scripts/analyse.ts      the whole pipeline in a terminal
```
