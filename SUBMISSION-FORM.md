# HackMIT submission — field by field

## Sponsor challenges to select
- **Meta** — Bringing People Closer Together with AI
- **Elastic** — Find the Signal
- **Visa** — Reimagine Shopping

## Inspiration

One of us exported four hundred Instagram conversations, forty one thousand
messages, and went looking for the friends she had lost touch with since moving
countries. Scrolling found nothing. The messages that mattered were buried
under two years of "lmao" and "omw".

Then we found the thing that actually hurt. A friend had asked "how did the
interview go?? you never told me", and we had sent three hundred and eighty
seven messages in the fortnight after it without once mentioning the interview.
Not ghosting. Worse. We kept talking and dropped the thing she cared about.

Nobody loses friends in a fight. They lose them to a year of being busy. We
built the thing that finds what was left unfinished, and writes the one message
that reopens it.

## What it does

Give Insta Insights your Instagram or WhatsApp export and it reads it on your machine.

**It finds four things you cannot find by scrolling.**

- **Unanswered** — a question they asked that you never answered, even though
  you kept talking afterwards. Found by comparing the content words of their
  question against everything you said in the next fortnight.
- **Never happened** — plans said out loud, agreed to, never booked, with how
  many separate times each was raised.
- **They wanted** — things mentioned in passing, once, months apart.
- **Decay** — who you used to talk to daily and haven't in three hundred days,
  scored against that friendship's own rhythm rather than a global constant.

**It shows you why the friendship mattered**, with a recap built from how people
typed: the stretches you both could not stop laughing, the nights that ran past
3am, the messages somebody stopped to actually write.

**It ranks who you are closest to and shows its working** — six factors scored
separately, including how much of the thread is logistics rather than
friendship, which is the answer to "the person I message most is a colleague".

**It gets the group back in one room.** Pick the people, and it searches every
conversation at once for what each of them said they wanted, proposes plans the
evidence supports, names what would rule each one out, and takes it through
checkout with a spend cap.

Four ways to read the same archive: the app, a book you page through, a Wrapped
that makes you guess before it answers, and a card list.

**Every number is traceable.** `pnpm verify <export> "<quote>"` re-reads the
original file independently of the engine and prints who said it, when, and
every message you sent afterwards that could have been an answer.

## How we built it

Next.js and TypeScript, with a strict split: arithmetic finds the signals,
the model only writes sentences.

**Parsers.** Instagram's HTML export and both WhatsApp date formats. Three
things in Instagram's format corrupt the signal if you ignore them, and we
found all three the hard way: messages are written newest first; reactions live
in a list appended to the message cell, so decoding a cell whole turns a
question into `Are you feeling better?❤️Summer (Sep 24, 2023 11:55 pm)`; and
forwarded reels carry their captions in as though somebody typed them.

**Signal engine.** Cadence, decay, open loops by content-word overlap,
commitments gated on an activity word, and six closeness factors. No model
decides who your friends are.

**Elastic.** Every message is indexed with the engine's own classification
flags, which turns the question and commitment patterns into filters instead of
scans. It answers the cross-thread question the group planner needs: who has
ever mentioned wanting this. It also makes sessions durable, since the archive
can be read back from the index instead of reparsed.

**Muse.** `muse-spark-1.3` writes the reconnection drafts, does the group
synthesis, and captions the recap. Citations that do not point at a message we
supplied are discarded before the response returns, so the model cannot invent
a memory.

**Visa.** Scoped-credential agent commerce: one merchant, one amount, one
thirty minute window, and the human sees the cart and the reasoning before
anything moves. Sandbox throughout and labelled as such.

## Individual contributions

- **Candy Xie** — export parsers, the signal engine, closeness scoring, the
  Elastic layer, Muse integration, the Visa sandbox checkout, the book and
  Wrapped surfaces, and the claim verifier.
- **Rafay Farah** — the cards display contract and the Insights dashboard,
  built against a fixed JSON shape with its own test suite so the frontend
  renders cards and computes nothing.
- **Roman Stashkiv** — visual direction and the Wrapped deck, including the
  slide structure the desktop surface is built from.
- **Arav Chadha** — TODO: Arav, fill this in.

## Challenges we ran into

**Our first project failed.** We spent the first day on eye tracking and could
not get it accurate enough to navigate a page. We killed it with ten hours left
and started this.

**The timezone bug.** WhatsApp writes timestamps in the exporting phone's
timezone, so a Hong Kong history exported in New York lands twelve hours off
and every late-night signal fires on lunchtime. We recover the offset from the
quietest six hours of the day, since people sleep. It derived −12, −11 and −12
across three real chats with no input.

**Regexes lie on real data.** Counting "honestly" and "tbh" as candour scored
every conversation at maximum. "i'm crying" is laughter, not vulnerability. In
a student chat almost every "we need to" is coursework, not a plan. We only
found all three by running against a real archive.

**Eighteen conversations were silently disappearing.** Message ids are built
from the conversation name and our index keys documents by them, so two chats
sharing a display name collided and one overwrote the other. Every deleted
account exports as "Instagram user". A real archive lost eighteen conversations
and two hundred and nineteen messages on the way into search before we caught
it.

**Searching globally then filtering.** The group planner searched the whole
archive and filtered to the chosen people afterwards. Across four hundred
conversations the top results are almost never from the four you picked, so a
plan for four friends was built from a single message. Moving the filter into
the query took it from one candidate to twenty.

## Accomplishments that we're proud of

**It can say no.** A friend who messaged three days ago scores 0.029 and is not
flagged. A ranking that flags everyone is a mood, not a system.

**Nothing on screen is invented.** We cut three features we had designed,
funniest-messages-by-reactions, a texting archetype, and a percentile score,
because the data did not support them. Every remaining number is counted and
checkable in one command.

**The model refuses to oversell.** Asked to plan for three friends, Muse
returned "only two of the three have shown interest in this, Theo has not
mentioned exhibitions or pottery" rather than dressing the gap up.

**It runs on a real archive.** Four hundred and nine conversations, forty one
thousand one hundred and seven messages, forty seven friendships going quiet.

## What we learned

That the interesting bug is never the one you planned for. Every signal we were
proud of came from a failure on real data: the timezone shift, the collision,
the filler that read as intimacy.

That honest output is a feature. Cutting the three fabricated slides made the
demo shorter and much stronger, because everything left standing can be
checked.

That arithmetic should find and a model should narrate. The moment we let the
model decide what counted, it agreed with everything.

## What's next for our project

**A local model.** Our promise is that your messages stay on your machine, and
calling a hosted model is the one place we do not fully keep it. Running the
drafting locally closes that gap.

**Reconnect and You Both Wanted This.** Both detectors exist and both fire
rarely: topic decay and cross-person wish matching need real semantic search
rather than phrase patterns. The contract already has a slot for them.

**Sending.** There is no API for sending an Instagram DM, so today the draft is
copied. A browser extension could put it in the box.

**Group availability.** We can already infer when someone is awake from their
message timestamps. Turning that into a date everyone can make is the obvious
next step for Friendsgiving.
