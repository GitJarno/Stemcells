# The way forward for Aski: say it once, Cells fly, you answer in one keystroke

Aski's job is to get the most Cell work out of each minute of the person's
attention, and to make sure no Cell ever waits on them unseen. This page is
the direction and its first move. It builds on `aski-manager.md` (the room,
stages, close-out) and `aski-room.md` (cards, holds, answers by words).

## First principles

1. **Attention is the only scarce thing.** Cells are cheap and parallel; the
   person is one. A week on this Mac (2026-10-17 to 24): 152 Cells in 12
   projects, 11 runs at once at the peak, back to a Cell every 3 min
   (median), 5 of the person's turns per Cell (median).
2. **Each party knows one thing best.** The Cell knows what it needs (it has
   the context), Aski what goes on across Cells, the person alone has the
   authority and the taste. So the Cell writes the ask, Aski routes it, the
   person decides.
3. **A missed ask costs more than a stop.** A Cell shown done while it waits
   on the person loses hours; a false alarm costs seconds. Ties go to
   "needs you".
4. **The harness is the thinnest layer that works.** T3 holds the truth;
   Aski derives from it and keeps no copy. Code before models; a part goes
   once models don't need it.
5. **When the person is involved, cognitive load is the cost.** A card is
   one decision with what waits on it, never a digest. One keystroke when
   the Cell's recommendation is right; the Cell's own words when it isn't.

## The contract: every stop is done, an ask, or waiting

Aski reads the Cell's close-out, not its prose.

- **Done**: green, in the Done list with Settle. It names its evidence: a
  pull request, a commit, a check.
- **Ask**: red, one card. A choice goes through the question tool (2 to 4
  options, the recommendation first). `Left: you` is for a step only the
  person can take (sign in, send the mail).
- **Waiting**: yellow, at work, no card: `Left: waiting` or `Left: me`.

Prose with no contract gets the fallback card, in the Cell's own words.

## Three moves, each with a gate

1. **Catch every ask** (this page's slices). Gate: a replay of a week's
   stops finds no Cell shown done while it waits on the person, and most
   asks come through the question tool.
2. **One keystroke per ask**: "ok" takes every recommendation, Tab
   completes an option, a walk through the cards, the phone's push opening
   on its card (answers, never allows), settings answered with the live
   control in Aski's reply, past chats opening beside Aski, never over it.
   Gate: median time to answer under a minute, in one or two keystrokes.
3. **Longer arcs**: "done when" in every brief, how far Cells go alone per
   project (local, pull request, merge), autonomy the person grants once
   they always take a kind of ask's recommendation, Aski's prose read only
   if it is still needed. Gate: fewer of the person's turns per Cell, missed
   asks still at zero, Undo under 3 %.

## Measured from T3's own records

The person should be able to see what Cells give them: arcs getting longer,
fewer interruptions, more decisions made in a keystroke. T3's event log
already holds every run, request, message and settle with its time, so the
numbers are derived from it, back to the first day, with no store of our
own. Only what T3 can't see (an answer taken back in its hold) would ever
need a counter.

- Missed asks: stops read done whose next message from the person answers
  something.
- Asks through the question tool, against `Left: you` and prose.
- Time from card to answer, and the keystrokes it took.
- The person's turns per Cell, and a Cell's time in flight between them.
- Undo rate.

The view of it ("this week: arcs 30 % longer, 40 fewer interruptions") is a
later slice; first the derivation, checked against the replay.

## Not building

Org charts, per-agent budgets, heartbeats, a kanban, a second state store,
a model reading every turn, Aski writing words a Cell reads, auto-answers
on anything irreversible.

## Move 1 slices

- [x] 1. **Read list-form close-outs.** Cells write "a line per owner" as
      a list under a bare `**Left:**`; the reader saw only one-line labels,
      so those Cells showed done. A list's steps are read one a line, steps
      set in under an owner are that owner's, and the person's steps read
      as one card.
- [x] 2. **The contract, sharper.** The section every Cell gets: choices
      through the question tool, `Left: you` only for the person's own
      step, Done names its evidence, the labels and owner words in English
      whatever language the reply is in.
- [x] 3. **Aski reads the room in one call.** `stemcells_standing`, read
      only: the numbered cards, the Cells at work and the done ones with
      their lines; the persona answers "what needs me?" from it.
- [ ] 4. **The numbers, derived.** The measures above from T3's records,
      replayed over the person's history, read locally.

## Review

- Slice 1, replayed over the 384 stops Cells made on 2026-10-23 and 24
  (read only): 61 that showed done now need the person (59 of them name
  the person's step), 76 more are still at work, one that read "stopped
  short" is waiting on CI, and none that needed the person now shows done.
  Owner words in another language (`sinä:`) read as the person's, the safe
  side, until slice 2 keeps the labels in English.
- Slice 2: the section shows the list it asks for, and a contract test
  reads that example as the Cell means it, so the instruction and the
  reader can't drift apart again. With no question tool, a Cell asks in
  its last paragraph and ends with `Left: you`.
- Slice 3: `stemcells_standing` reads the list Aski's room streams (one
  Needs per server: Effect builds a layer once however many layers provide
  it), so "for 3" in Aski's words is card 3. It joins our MCP tools with no
  new seam, and the persona contract test now resolves our tools too.
