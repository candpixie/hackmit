# Insta Insights

**The friendships you're about to lose, and the one message that gets them back.**

Candy Xie · Arav Chadha · Rafay Farah · Roman Stashkiv — HackMIT 2026

Drop in your Instagram or WhatsApp export. Insta Insights reads it on your machine,
finds the friendships that went quiet while you were busy, shows you exactly
what was left unfinished in each one, writes the message that reopens it, and
gets the whole group back in a room.

---

## The problem

Nobody loses friends in a fight. They lose them to a year of being busy. And by
the time you notice, the thing that would fix it, the specific unfinished
thread you could pick back up, is buried under four thousand messages you will
never scroll through.

We built this on a real archive: 409 Instagram conversations, 41,107 messages.
It found 47 friendships going quiet.

## What it finds

**Unanswered.** They asked you something and you never answered it. Not "you
stopped replying": you *kept talking* and never came back to the question.
Found by comparing content words between their question and everything you said
in the fortnight after it. On the real archive, one friend's question was
followed by 387 messages, none of them about it.

**Never happened.** "We should do that pottery class", said out loud, agreed to,
never booked, with how many separate times it was raised.

**They wanted.** Things mentioned in passing, once, months apart.

**Decay.** Who you used to talk to daily and haven't in three hundred days,
scored against that friendship's own rhythm rather than a global constant.

Plus a recap built from how people typed, a closeness ranking that shows its
six factors, and a group planner that searches every conversation at once.

Every claim carries the message it came from. `pnpm verify` re-reads the
original export independently of the engine and settles any of it.

## Two implementations, one contract

`CARDS_CONTRACT.md` fixes a JSON shape: one card per insight, same fields
whatever the kind, evidence as real messages. Two backends were built against
it independently, and either frontend renders either backend.

| | |
|---|---|
| **TypeScript** (`src/`) | The submitted app. Muse Spark, Elasticsearch, Visa sandbox checkout, four surfaces |
| **Python** (`insights/`) | A second implementation with its own test suite, all seven card kinds, and a DM-style frontend |

The contract holding across two languages and two teams is the part we did not
expect to work as well as it did.

## Who built what

- **Candy Xie** — export parsers, the signal engine, closeness scoring, the
  Elastic layer, Muse integration, the Visa sandbox checkout, the book and
  Wrapped surfaces, the claim verifier.
- **Arav Chadha** — the Python implementation in `insights/`, its test suite,
  the DM-style frontend in `frontend/`, and the design directions in
  `mockups/`.
- **Rafay Farah** — the cards display contract and the Insights dashboard,
  built so the frontend renders cards and computes nothing.
- **Roman Stashkiv** — visual direction and the Wrapped deck the desktop
  surface is built from.

## How the sponsors' pieces fit

**Meta.** Muse Spark (`muse-spark-1.3`) writes the reconnection drafts, does the
group synthesis, and captions the recap. The input is a Meta data export,
parsed from Instagram's own HTML. Citations that do not point at a supplied
message are discarded before the response returns, so the model cannot invent a
memory.

**Elastic.** One archive fits in a loop. Four hundred do not. Every message is
indexed with the engine's own classification flags, which turns the question and
commitment patterns into filters instead of scans, and answers the cross-thread
question the planner needs: who has ever mentioned wanting this. It also makes
sessions durable, since the archive can be read back from the index.

**Visa.** Scoped-credential agent commerce: one merchant, one amount, one
thirty minute window, and the human sees the cart and the reasoning before
anything moves. When the total exceeds the cap the agent changes the order and
says which line it dropped. Sandbox throughout and labelled as such.

## Run it

```bash
pnpm install
pnpm ig-corpus     # synthetic Instagram export, no real data needed
pnpm dev
```

Everything works with no API keys: drafting falls back to a grounded template,
search falls back to an in-memory BM25, and the response says which backend
answered. See **TESTING.md** for what to click.

The Python implementation:

```bash
pip install -r requirements.txt
python -m insights
```

## Your data

Parsed on your machine. Nothing is written to disk. If search is configured
your messages are indexed in your own Elasticsearch under a random session id,
and asking for a draft sends the few quoted messages to the model. Nothing else
leaves.

The repo ships synthetic corpora so the tests and the public demo never contain
a real person's messages. `data/private/` is gitignored for your own exports.

## Layout

```
src/lib/parse.ts        WhatsApp export formats
src/lib/instagram.ts    Instagram HTML export
src/lib/signals.ts      decay scoring and the four evidence types
src/lib/closeness.ts    six factors, each shown with its number
src/lib/elastic.ts      indexing, cross-thread retrieval, session durability
src/lib/build-cards.ts  the engine, as the display contract
src/app/                the app, the book, Wrapped, the dashboard
insights/               the Python implementation
frontend/               the DM-style frontend
mockups/                design directions
scripts/verify.ts       trace any claim back to the export
```
