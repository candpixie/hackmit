# Overdue — HackMIT submission

**The friendships you're about to lose, and the one message that gets them back.**

Repository: https://github.com/candpixie/hackmit

---

## Who this is for

People who moved. Students who left home, graduates a year out, anyone whose
closest friendships are now in another timezone and another chat app.

They did not fall out with anyone. They got busy, and a year later the friendship
is technically intact and functionally over. The thing that would fix it is one
specific unfinished thread, and it is buried under four thousand messages nobody
is ever going to scroll through.

We built this on a real archive: 409 Instagram conversations, 41,107 messages,
belonging to one of us. It found 47 friendships going quiet, and the things it
surfaced were ones she had genuinely forgotten.

## How it strengthens connection

Most apps in this space make you feel something and then leave. Overdue is built
to end in a sent message.

**It finds what was left unfinished.** Four signals, none of them mood scores:

- **Unanswered.** They asked you something and you never answered it. Not "you
  stopped replying": you *kept talking for weeks* and never came back to the
  question. Found by comparing content words between their question and
  everything you said in the fortnight after it. This is the signal nobody finds
  on their own, and it is the one that makes people actually send the message.
- **Never happened.** "We should do that ceramics class." Said once, never done.
  Requires both a commitment and an activity, because in a student chat almost
  every "we need to" is coursework.
- **They wanted.** Things they mentioned wanting, months apart, in passing.
- **Decay.** Who you used to talk to daily and haven't in three hundred days,
  scored against that friendship's own rhythm rather than a global constant.

**It shows you why the friendship mattered.** A recap built from how people
typed: the stretches where you both could not stop laughing, the nights that ran
past 3am, the messages somebody stopped to actually write.

**It ranks who you are closest to, and shows its working.** Six factors scored
separately: reciprocity, depth, warmth, candour, longevity, and how much of the
thread is logistics rather than friendship. That last one answers the obvious
objection, that the person you message most is often a colleague.

**It gets the group back in one room.** Pick the people, and it searches every
conversation at once for what each of them said they wanted, then proposes plans
the evidence supports and names what would rule each one out.

## Why AI is essential

Not for the finding. The signals above are computed from message counts,
timestamps, lengths and phrasing, deliberately, so that every claim can point at
a message you can read. We never wanted a model deciding who your friends are.

AI does the two things arithmetic cannot:

**Synthesis across people.** "What would these five friends all actually enjoy"
is not a database query. It requires reading twenty fragments from five separate
archives, written over two years, and finding the one thing they point at. Muse
Spark does that, and every option it proposes quotes the message that justifies
including each person.

**Writing the message.** The gap between knowing what to say and being able to
say it is the entire problem. "Hey stranger, long time no see" is what people
send when they cannot face writing the real thing. The model opens on the
specific unfinished thread instead of on the silence, and it sounds like a
person texting a friend.

Both are grounded. Citations that do not point at a message we supplied are
discarded before the response is returned, so the model cannot invent a memory.
Muse holds that line on its own too: asked to plan for three friends it returned
"only two of the three have shown interest in this, Theo has not mentioned
exhibitions or pottery" rather than dressing the gap up.

## How the sponsors' pieces fit

**Meta.** Muse Spark (`muse-spark-1.3`) writes the reconnection drafts, does the
group synthesis, and captions the recap. The input is
a Meta data export, parsed directly from Instagram's own HTML format. Three
things in that format corrupt the signal if you ignore them, and we found all
three the hard way: messages are written newest first; reactions live in a list
appended to the message cell, so decoding a cell whole turns a question into
`Are you feeling better?❤️Summer (Sep 24, 2023 11:55 pm)`; and forwarded reels
carry their captions in as though somebody typed them.

**Elastic.** One archive fits in a loop. Four hundred do not. Every message is
indexed with the engine's own classification flags, which turns the question and
commitment patterns into filters instead of scans, and cross-thread retrieval is
what the group planner runs on. The bug that proves the point: we were searching
globally and filtering to the selected people afterwards, and across 409
conversations the global top hits are almost never from the four you picked, so
a plan for four friends was being built from a single message. Moving the filter
into the query took it from 1 candidate to 20.

**Visa.** Checkout follows scoped-credential agent commerce. The agent never
holds an open instrument: one merchant, one amount, one thirty minute window, and
it has to show the human the cart and its reasoning before anything moves. When
the total exceeds the per-person cap it changes the order and says which line it
dropped, rather than quietly overspending. Sandbox throughout and labelled as
such, because a demo that claims a real payment is a demo that lies.

## On privacy

Exports are parsed in memory for the length of a session and never written to
disk. The repository ships synthetic corpora, for both WhatsApp and Instagram, so
the public demo and the tests never contain a real person's messages. Real
exports live in a gitignored folder. When Elasticsearch is configured, messages
are indexed under a random session id that scopes every query, so two people on
one cluster never see each other's archives.

## Three things worth pointing at

**It can say no.** A friend messaged three days ago scores 0.029 and is not
flagged. A ranking that flags everyone is a mood, not a system.

**It recovers your timezone from when you sleep.** WhatsApp writes timestamps in
the exporting phone's timezone, so a Hong Kong history exported in New York lands
twelve hours off and every late-night signal fires on lunchtime. We infer the
offset from the quietest six hours of the day and it derived −12, −11, −12 across
three real chats with no input.

**Every number is visible.** Six factors, each with a sentence explaining it, no
percentages of anything, and no invented "97% best friend".

## Running it

```bash
pnpm install
pnpm ig-corpus   # synthetic Instagram export, no real data needed
pnpm dev
```

Everything works with no API keys at all: drafting falls back to a grounded
template and search falls back to an in-memory BM25, and the response says which
backend answered.
