# Testing Overdue

Two minutes, no API keys, no personal data.

```bash
git clone https://github.com/candpixie/hackmit.git
cd hackmit
pnpm install
pnpm ig-corpus        # writes a synthetic Instagram export
pnpm dev
```

Open http://localhost:3000 and use the **synthetic archive** below. You do not
need anyone's real messages to see everything work.

## What to click

The header has four tabs. All four read the same archive.

| Tab | What it is |
|---|---|
| **Find** | The ranking, the evidence, and the draft |
| **Read** | The archive as a book you page through |
| **Wrapped** | Six slides, including the guess |
| **Cards** | Everything as a list |

**Start on Find.** Paste `data/corpus-instagram/inbox` into the Instagram box
and press *Read it*. Takes a couple of seconds on the synthetic corpus. Every
other tab then uses that same archive.

## The five things worth checking

1. **The ranking can say no.** Rafa Ortiz messaged 3 days ago and scores
   0.029, unflagged. A ranking that flags everyone is a mood, not a system.
2. **"You kept talking. You never answered it."** Open Mei Tanaka on Find. Not
   "you stopped replying": messages kept flowing and the question was dropped.
3. **The draft cites its evidence.** Press *Write to Mei*. The cards it used
   light up; the ones it ignored stay dark.
4. **Wrapped slide 3 asks you to guess** before it answers. Get someone else to
   guess.
5. **The checkout guardrail.** Find → *Get them all in one room* → pick a plan →
   set the cap to 20. The agent drops a line item and says so, and refuses to
   claim it met a cap it missed.

## Without keys

Everything above works with no `.env.local` at all:

- **Drafts and plans** fall back to a grounded template. Real text, no model.
- **Search** falls back to an in-memory BM25. The response says which backend
  answered (`in-memory` vs `elasticsearch`).
- **Sessions** live in memory only and are lost on restart.

## With keys

Copy `.env.example` to `.env.local` and fill in what you have. Each is
independent; neither is required.

```bash
META_API_KEY=            # Muse Spark writes drafts, plans, recap captions
LLM_BASE_URL=https://api.meta.ai/v1
LLM_MODEL=muse-spark-1.3

ELASTIC_URL=             # cross-thread search, and sessions that survive restarts
ELASTIC_API_KEY=
```

Get a Muse key with `curl -fsSL https://dev.meta.ai/install.sh | bash`, then
`muse login`. The key lands in your keychain under `ai.meta.dev.credentials`.

You can also paste a Muse key straight into the app: **Use your own Muse key**
on the Find tab. It stays in your browser and is never sent to our server.

Check a cluster before blaming the app:

```bash
pnpm check-elastic     # reachable, authorised, can create, write, search
```

## Testing on your own messages

Nothing you load leaves your machine except the few quoted messages that go to
the model when you ask for a draft.

- **Instagram:** Your activity → Download your information → **HTML**. Give the
  app the path to the `inbox` folder.
- **WhatsApp:** open a chat → Export Chat → Without Media. Drag the `.txt` onto
  the page.

Real exports belong in `data/private/`, which is gitignored. `cards.json` and
`insights.json` are gitignored too, because they contain real messages and this
repo is public.

## Checking a claim against the source

The app's argument is that nothing on screen is invented. One command settles
any of it:

```bash
pnpm verify data/corpus-instagram/inbox "pottery"
pnpm verify ~/Downloads/inbox "insurance agreement"
```

It re-reads the original export independently of the engine and prints who said
it, when, and for a question, every message sent afterwards that could have
been an answer.

## Terminal only, no browser

```bash
pnpm analyse data/corpus                  # WhatsApp corpus
pnpm ig data/corpus-instagram/inbox       # Instagram corpus
pnpm cards <dir> cards.json               # the card feed as JSON
pnpm insights <dir> insights.json         # the full analysis as JSON
```

## If something looks wrong

- **Everything says "sample archive"** — the header shows which archive is
  loaded. Press *Read it* on Find; all four tabs follow.
- **"That archive is no longer loaded"** — the session was evicted and Elastic
  is not configured. Load it again.
- **A tab looks stale** — hard refresh. Next caches aggressively in dev.
- **Drafts take 20 seconds** — expected. `muse-spark-1.3` reasons before it
  writes. The UI names the step it is on.
