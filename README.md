# Overdue

**The friendships you're about to lose, and the one message that gets them back.**

Drop in your WhatsApp exports. Overdue finds the friendships that went quiet
while you were busy, shows you exactly what was left unfinished in each one,
and writes the message that reopens it.

## What it actually finds

Scrolling your own chat history does not work. These do:

- **Decay** — who you used to talk to daily and haven't in 300 days, scored
  against that friendship's own rhythm rather than a global constant.
- **Unanswered** — they asked you something and you never answered it. Not
  "you stopped replying": you *kept talking* and never came back to the
  question. Detected by content-word overlap between the question and
  everything you said in the fortnight after it.
- **Never happened** — "we should do the pottery class", said once, never done.
- **They wanted** — things they mentioned wanting, months apart.

Every signal carries the message ids it came from. Nothing in the UI makes a
claim it cannot point at, and the draft highlights the exact messages it used.

## Your data

Exports are parsed in memory for the length of a session. Nothing is written to
disk, nothing is stored, and nothing leaves the page until you ask for a draft.
The repo ships a synthetic corpus so the tests and the public demo never contain
a real person's messages. `data/private/` is gitignored for your own exports.

## Run it

```bash
pnpm install
pnpm corpus     # generate the synthetic archive
pnpm analyse    # prove the engine in a terminal, no keys needed
pnpm dev
```

Drafting falls back to a grounded template when no model is configured, so the
app works with zero setup. To use a model:

```bash
# .env.local
LLM_BASE_URL=https://api.meta.ai/v1
META_API_KEY=...
LLM_MODEL=muse-spark-1.3
```

The client is OpenAI-compatible, so any compatible endpoint works.
