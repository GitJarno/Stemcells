# Autonomy earned: Aski takes what the person always takes

`aski-forward.md`, Move 3, slice 4. The person chose it for reversible asks
only (2026-10-24): after five straight takes of one kind's recommendation,
Aski offers once to take it from then on.

## The kinds

Only cards with one fixed recommendation that a turn can take back:

| Kind        | Card                                      | Taking it sends                      |
| ----------- | ----------------------------------------- | ------------------------------------ |
| `retry`     | a run failed on the transport or provider | "Try that again."                    |
| `goAhead`   | a Cell stopped short of done              | "Go ahead."                          |
| `implement` | a plan is ready                           | the plan, to build, out of plan mode |

Never a permission, a question, a sign-in, a limit, a deploy or a merge:
those are a person's call every time.

## How it works

- **Every take carries the boundary**: the card's own words, then "Stop
  and ask me before anything final: a deploy, a merge, a release, deleting
  something, or spending or sending anything." A word list can't tell
  what is final; the Cell reading this can. A card whose own ask is
  plainly final stays the person's all the same.
- **The server does it**, so Cells fly while the person is away and two
  screens never both answer. `stemcells/autonomy/` follows the needs list;
  its command id is the card's key, so the orchestrator takes it once
  however often it is sent.
- **A take is counted when the card leaves**: the Cell's next message from
  the person is the card's own words for its recommendation (a click, a
  dictation, or the same words in the Cell's chat), or it isn't. Five in a
  row of one kind makes the offer; anything else starts the count again.
  The counts and grants live in our own file in the server's state.
- **The offer** is a card of its own in Aski's room: "You went ahead the
  last 5 times a Cell stopped short. Go ahead for you from now on?" A
  click grants it; "Not now" declines it, and Aski doesn't offer that kind
  again. Words never grant it.
- **A taken card** shows in the room for the undo window before it goes:
  "Going ahead for you" with Undo, which keeps that card for the person.
- **The way back**: Settings › Aski has a switch per kind, and Aski can
  show them in a reply.

## Slices

- [x] 1. Server: the kinds, the count from each card's leaving, the grants
      file, the take with its 30 s window, and `/api/stemcells/autonomy`
      (the view as a stream; grant, decline, keep). Switching a kind off is
      a decline: Aski stops and doesn't offer it again until it's switched
      on. A card naming a deploy, a merge or a deletion is never taken or
      counted, and a Cell someone is writing to keeps its card.
- [x] 2. The room: the offer card, the taken card's fuse and Undo, Settings
      › Aski's switches, and Aski's inline switches (`takes-retry`,
      `takes-go-ahead`, `takes-implement`). An answer of the person's own
      keeps the card from Aski, and a card Aski took says so as it goes.

## Review

An independent review of slices 1 and 2, before the room's half shipped,
found and #294 fixed:

- The word guard took three rounds and still couldn't hold alone. Read
  over the whole run it blocked 10 of 11 real stops (every Cell here
  talks of merging); read over the card's ask it still missed "land the
  PR", "send the email", and a retry of a run the person had sent on with
  "Go ahead." after a deploy. So every take now carries the boundary
  above, and the guard only keeps cards whose ask is plainly final: a
  Cell's stop, a plan, or what a retry repeats, read back to the person's
  own request through any "Go ahead." or "Yes" and the reply it answered.
- A sleeping Mac ended windows unseen, and drafts lapsed meanwhile. After
  a start or a wake (between looks or within one) no card goes for 90 s,
  windows start again, and the room's fuse waits for its window.
- Undo or a switch turned off could lose to a take already due; a take
  checks both again just before it goes. A refused take stays the
  person's instead of coming back every window.
- Saves could land out of order and turn a declined kind back on; they
  now go one at a time. A file from before grants had times still reads.
- A grant took the cards already waiting too; it now takes only those
  that come after it.
- Aski's takes, and scheduled tasks, counted as the person's own turns in
  the arcs and as their answers; neither does now.

The phone shows neither the fuse nor Undo, and a reply being written
there doesn't hold a take back: the phone has no Aski room yet
(`phone-push.md`, slice 5). Settings on the Mac turns a kind off.
