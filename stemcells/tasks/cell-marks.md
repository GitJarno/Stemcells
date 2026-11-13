# Marks: what a Cell earned, from the ledger's facts

The ledger (`cell-ledger.md`) keeps what happened to a Cell. A mark is a
piece of evidence read out of those facts: this run landed alone, this
pull request merged. It is not a count and not a score, and it is not
stored: the marks are worked out each time they are asked for, so a mark
added later is awarded for the past too.

## What it is

- **Pure functions over facts**, in `stemcells/ledger/marks.ts`, shared by
  every app and safe for the phone's Hermes. `marksByThread(facts)` gives
  each life its marks, in the order it earned them. A life with none isn't
  listed.
- **Six marks.** Each is earned once a life, and dated by the fact that
  earned it. A record lists all six, the nearest first.

  | Mark           | Earned by                                                                             | Shows            |
  | -------------- | ------------------------------------------------------------------------------------- | ---------------- |
  | Landed alone   | a run that landed with Done, asked the person nothing and worked 10 min on its own    | that time        |
  | Merged         | a pull request of its own that merged                                                 | its number       |
  | Frequent flyer | ten landings in one life, at the tenth                                                | all its landings |
  | Radio silence  | five landings in a row with Done and nothing asked, at the fifth                      | its longest row  |
  | Hat-trick      | three pull requests merged in one life, at the third                                  | all its merges   |
  | Long haul      | its landed runs coming to 2 h on their own in one life, at the landing that passed it | all of it        |

- **A Cell's marks are the second dimension of the collection**
  (`collection.md`): a feat is the crew's and the person's, a mark is one
  Cell's. Settings › Collection › Cells shows the Cell picked with its
  record: all six, the earned ones with what shows them and the day, the
  rest with what they take. It asks the machine for the marks alone
  (`GET /api/stemcells/collection/cells?threads=`), worked out from the
  facts the collection already holds, so the Mac and the phone read the
  same record. A mark gets no card: a feat's moment is the crew's, and a
  Cell merging its first pull request happens too often to interrupt for.
- **The thresholds are growth's own stages**, imported and never copied:
  10 min is growth's first stage and 2 h its last
  (`GROWN_MS` in `stemcells/ledger/alone.ts`, which the web's
  `cell/growth.ts` now reads its table from). Growth is worked out from
  upstream's runs and a rollback takes it back; a mark is the same count
  made durable.
- **The words** are in `stemcells/words/marks.ts`: each mark's name, what
  shows it ("42 min", "#12") and the sentence that says what the Cell did.
- **Settings › Lineage** lists each life's marks under it as its card
  opens: its icon in the ink of the words beside it, the name, and what shows it; the day and the sentence on
  hover. No new creature art. The page reads `GET /api/stemcells/ledger` for the card's
  chats and works the marks out in the browser.

## Choices

- **Landed alone wants no ask at all.** The fact counts the requests that
  held the run until the person answered, the ones growth counts as waits,
  and the mark wants none.
- **The first fact stands for a mark.** A later, longer run doesn't move
  Landed alone, and a second merge doesn't add another Merged. Long haul
  is dated by the landing that passed two hours and shows all the life's
  time alone since.
- **This machine's lives only.** Each machine keeps its own ledger; a life
  on another machine lists no marks here.
- **No marks while the ledger can't answer.** A failed read shows the page
  as it was before marks, with no error: the marks are an addition.
- **Six icons of our own**, drawn as the app's icons are: a 24 unit
  square, a stroke of 2 with round caps, no fill
  (`lineage/markIcons.ts`, one set of shapes for the Mac and the phone).
  A flight coming down onto the ground, two lines joined into one, a loop
  in the air, a speech bubble with nothing said, a top hat, a stopwatch.
  The shape says which mark; none wears a hue. They were first cut from
  blocks on the Cell's 7 × 7 grid, which read as crude at an icon's size
  and didn't scale.

## Plan

- [x] `GROWN_MS` beside `aloneIn`; growth's table reads it.
- [x] `stemcells/ledger/marks.ts` and its tests.
- [x] `stemcells/words/marks.ts`.
- [x] `lineage/marks.ts` (the read), `MarkGlyph.tsx`, and the list in
      `LineageSettings.tsx`.
- [x] Before and after captures of the page, on a scratch home.

## Review

- **Tests**, `stemcells/ledger/marks.test.ts`: the thresholds are
  growth's; each condition of Landed alone at its edge (a second short,
  one ask, something left, no close-out, a long run mostly spent waiting);
  the first run stands for the mark; Merged once, by its first; Long haul
  at the landing that passes two hours; each life its own, in order.
- **Seen**, headless, on a scratch home with fake providers, Replay chats
  and made-up facts written to that home's own ledger: a life with all
  three marks, lives with one, and a life with none, which reads as it did
  before.
- **Not seen:** the page on a light ground. The three hues are the tokens
  the rest of the layer draws on both grounds.

## Left

- A mark on the Cell's figure.
- Lineage on the phone.
- An MCP tool for agents to read a Cell's marks.
- `landed` could record the verdict on a landed run (shown, claimed or
  short) once that lands, and a mark could then ask for a landing that
  was shown rather than one that only said Done.
