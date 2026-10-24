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
need a counter. A chat T3 imported from before its V2 keeps its messages
but not its runs, so the history starts with the first run on this server.

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
- [x] 4. **The numbers, derived.** The measures above from T3's records,
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
- Slice 4: `GET /api/stemcells/arcs` gives the last eight weeks, worked out
  from T3's records when asked (0.6 s over this Mac's 1.4 GB store). The
  week of 2026-10-19, the first on V2 here: 105 Cells, 660 of the person's
  turns (3 a Cell), a median flight of 1.8 min between turns, 21 asks
  through the tool against 72 `Left: you` and 45 in prose, answered in a
  median 4.4 min; 484 of 728 stops said nothing of where they stood, most
  of them before the close-out landed on 2026-10-23. The view of it comes
  later; these are its baseline.

## Move 2 slices

- [x] A. **Past chats open beside Aski.** A chat Aski links opens in a tab
      of its own after Aski's, never over the talk (#282).
- [x] B. **"ok" takes every recommendation.** "ok the rest" after some
      answers, or "ok to all" alone, takes each other card's recommended
      option; one only a click allows just lights (#283, #289).
- [x] C. **Tab completes an option.** After a card's number its
      recommendation shows as a ghost, and the first letters of another
      option narrow it; Tab writes it (#284).
- [x] D. **A walk through the cards.** ↓ from Aski's empty composer
      lands on the first card's recommendation, Enter takes it and steps
      on, ↑ and ↓ move card to card, Esc goes back; the focus holds the
      list still (#285).
- [x] E. **Settings in Aski's reply.** Asked about a setting, Aski links it
      and the reply draws its switch, writing where Settings writes: Aski
      divides the work, suggestions, auto-settle on merge, keeping Cells
      with a pull request, carrying on or snoozing at a usage limit. Others
      it names in Settings (#286).
- [ ] F. **The phone's push opens on its card.** Waits on the person: no
      push leaves this Mac without a service that isn't ours.

## Move 3 slices

- [x] 1. **Done is settled first.** Every Cell is told to know what done
      is before it starts (what it delivers, what shows it works), the
      smallest result that fully answers when the ask doesn't say, and to
      carry it there before it stops (#287).
- [x] 2. **Aski says what Cells give the person.** Asked how it's going,
      Aski answers from `stemcells_arcs`: the measures above, this week
      against the last, in three lines (#288).
- [ ] 3. **How far Cells go alone, per project.** Waits on the person.
- [ ] 4. **Autonomy earned.** Waits on the person.
- [ ] 5. **Aski's prose read, only if still needed.** Waits on a week of
      stops under the close-out (from 2026-10-24).

## Review of moves 2 and 3

- On the common path an ask now takes one or two keys: "ok to all" or "ok
  the rest", a card's number and Tab, or ↓ and Enter down the cards. A
  setting is changed where Aski names it, and a past chat opens beside the
  talk. The gate (median answer under a minute) can only be read after a
  week of use; the baseline is 4.4 min, the week of 2026-10-19.
- An independent review of B to E found words meant elsewhere taking every
  card's recommendation ("Floof, go with your recommendation") and a
  title's start choosing an option the words then contradicted ("5 commit,
  then push"). #289 narrowed both: "the rest" holds only as the whole
  message or after answers that each answered, and always names which
  cards; a title's start holds only where the words stop. No reading ever
  sent an option that allows: those only light.
- The arcs on this Mac's store, through `stemcells_arcs` (42 ms): 109
  Cells this week, 3 of the person's turns a Cell, 1.8 min of work between
  turns, 21 asks on a card against 77 as the person's step and 45 in
  prose, answered in 4.5 min. Slice 1's effect shows there from next week.
- Left for the person: F (a phone push needs a service beyond this Mac),
  3 and 4 (how far Cells go alone, and autonomy earned, both let Cells act
  without asking). 5 waits on a week of stops under the close-out.
