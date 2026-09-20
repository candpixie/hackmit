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


## How it works

```
   your export                  the engine                    what you read
 ┌──────────────┐         ┌───────────────────┐         ┌──────────────────┐
 │  Instagram   │         │  parse            │         │  Find    act     │
 │  HTML  or    │ ──────▶ │  score            │ ──────▶ │  Read    book    │
 │  WhatsApp    │         │  index            │         │  Wrapped share   │
 │  .txt        │         │  narrate          │         │  Cards   list    │
 └──────────────┘         └───────────────────┘         │  DM      review  │
   on your machine          arithmetic finds,            └──────────────────┘
   never uploaded           the model writes               one card feed
```

Every surface renders the same JSON. That is why they agree with each other.

### Where each sponsor sits

```
  messages ──▶ parse ──▶ signals ──▶ ELASTIC index
                            │             │
                            │             ├──▶ cross-thread search
                            │             └──▶ session survives restart
                            ▼
                         evidence
                            │
                            ├──▶ MUSE  draft the message
                            ├──▶ MUSE  synthesise a group plan
                            └──▶ VISA  scoped checkout, spend cap
```

**Arithmetic finds. The model writes. Neither does the other's job.** The signals
are counted from timestamps, message lengths and phrasing, so every claim can
point at a message. Muse is handed only the handful of messages it is allowed
to talk about, and any citation that does not match one is dropped before the
response returns.

### The one detection worth explaining

```
  Mei:  "how did the showcase go?? you never told me"        ← the question
         │
         │   the next 14 days
         ▼
  you:  387 messages                                          ← you kept talking
         │
         ▼
  none contain: showcase, interview, offer                    ← none about it
         │
         ▼
  UNANSWERED                                                  ← not "you ghosted"
```

Everyone builds "you stopped replying". This is the other thing, and it is the
one nobody finds by scrolling.

## Using it after the demo

The app is the fast path. Underneath, everything is a command, so the analysis
can go wherever you want it.

```bash
pnpm ig       ~/Downloads/inbox              # the ranking, in a terminal
pnpm cards    ~/Downloads/inbox cards.json   # the card feed as JSON
pnpm insights ~/Downloads/inbox out.json     # the whole analysis as JSON
pnpm verify   ~/Downloads/inbox "<quote>"    # trace one claim to the source
pnpm check-elastic                           # is the cluster reachable
```

`cards.json` is the display contract, so anything that can render a list can
render your archive. Two frontends in this repo already do.

Visit **/status** at any time for a live check of all three integrations: it
asks Muse which models it serves, asks the cluster how many documents it holds,
and hands the checkout a cart it cannot afford to confirm it refuses.

## Demoing each track

Two minutes each, on the live site or locally. Load the sample archive first;
every tab then uses it.

### Meta — Bringing People Closer Together with AI

Open **Find**, click Mei Tanaka, and read the Unanswered card out loud: she
asked something, you kept talking for weeks, and never came back to it. Press
*Write to Mei*. Muse Spark writes a message that opens on that specific
unfinished thread, and the evidence cards it used light up while the ones it
ignored stay dark. Then open **Wrapped** and let someone else guess who you
have ignored most before the reveal. The point to make: the finding is
arithmetic, deliberately, so that every claim can point at a message. Muse does
the two things arithmetic cannot, synthesising across five people's archives
and writing the message you could not face writing, and its citations are
validated against the supplied messages before the response returns.

### Elastic — Find the Signal

Open **Find**, press *Get them all in one room*, pick four people, and press
*Find something they'd all want*. The response reports `backend:
elasticsearch`. Every message was indexed with the engine's own classification
flags, so the question and commitment patterns are filters rather than scans,
and the planner asks one question of four hundred conversations at once: who
has ever mentioned wanting this. The bug worth telling them about: we searched
globally and filtered to the chosen people afterwards, and across four hundred
conversations the top hits are almost never from the four you picked, so a plan
for four friends was built from a single message. Moving the filter into the
query took it from one candidate to twenty. Sessions also read back from the
index, so the archive survives a restart.

### Visa — Reimagine Shopping

Same screen. Pick a plan, set the cap to 20, and press *Book this*.

The hard part of commerce is knowing what someone wants. We never ask. Nobody
typed "pottery class" into a search box: the intent was recovered from a
message a friend sent fourteen months ago, in a different conversation, to
somebody else. Discovery, personalisation and the decision all come out of
evidence the buyer forgot they had.

Then watch the guardrail. The agent never holds an open instrument: one
merchant, one amount, one thirty minute window, and it shows the cart and its
reasoning before anything moves. Over the cap it changes the order and says
which line it dropped, and if that still is not enough it says *"Dropped
Catalogue. Still $2.00 over the $20 cap"* rather than claiming a success it did
not achieve. Sandbox throughout and labelled as such, because a demo that
claims a real payment is a demo that lies.

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
