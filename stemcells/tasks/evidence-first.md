# Evidence first

An audit on 2026-11-10 measured the fork and what a person is asked to
read. Two findings drive this plan:

- **The fork.** 192 upstream files were edited, 2,217 lines, against about
  180,000 lines in our own folders. Syncs cost little, but the nightly had
  never landed one by itself: it stopped at the first conflict. A quarter
  of the edited files handed control to our code; the rest changed
  upstream's behaviour, tests or words in place.
- **Reading.** On a median day the Cells write 193 final replies, about
  40,500 words. A reply mixes evidence the system already holds as data,
  state, and judgment. Only judgment needs prose.

Each item below is one pull request with its own plan in this folder.

## The fork

- [x] Sync regenerates generated files instead of merging them (#98,
      `sync-regenerates.md`).
- [x] Our cases leave upstream's tests; `drift` holds the line (#102,
      `tests-stay-upstreams.md`).
- [x] A boundary test for the server, the phone and the desktop (#100,
      `boundary-everywhere.md`), and for the shared code at the
      repository's root (#113).
- [x] Words as data: a word table beside the name transform (#109,
      `word-table.md`).
- [x] The nightly carries on through a conflict, opt-in (#110,
      `nightly-carries-on.md`).
- [x] `seams.md`'s rows split by part of the repository (#113,
      `seams-split.md`).
- Dropped: the phone's rows as our own components. Their files aren't
  hot, and a substitute for one would be a whole copy of it. The word
  table shrank them instead.

Not here: offering fixes upstream. That is the person's call
(`stemcells/docs/fork.md`, rule 5).

## A ledger of our own

- [x] An append-only ledger of facts about Cells, in our own SQLite (#106,
      #108, `cell-ledger.md`).
- [x] Marks as pure functions over it, shown with a name's lives (#106,
      `cell-marks.md`).

## Forms

- [x] A question's option previews are drawn, on the Mac and the phone
      (#99, `question-previews.md`).
- [x] A `chart` fence drawn natively, on the Mac and the phone (#103,
      `chart-fence.md`).
- [x] The model-facing text teaches which form fits which content (#105,
      `forms-text.md`).
- [x] The close-out drawn as a card, on the Mac (#111,
      `close-out-card.md`); a run's facts drawn by one component (#112).
- Dropped: a run's receipt. Upstream already draws a run's duration, its
  changed files and its commands under the reply; the missing piece, the
  pull request's state, is in the close-out card's foot.
- Not built: the phone drawing a wide table as stacked rows, and the
  phone's close-out card. Both are changes to look at on a device, and
  the Mac this ran on had no room for a simulator build.

## Review

Thirteen pull requests landed in a day, each on a green `local-check`.

What the numbers say:

- `drift` went from 208 files to 187: the word table gave 21 files back
  to upstream's text, where the audit had guessed about 40.
- Upstream's three suites pass end to end with the skip list in place of
  edits to its tests: 9,480 tests for the web, 7,509 for the server.
- The registry of seams was one padded table every pull request met in;
  it is six files of one-line rows now, and `drift` names the file a
  missing row goes in.

One pass in the real app on `main` saw the pieces together: a reply with
a chart, a table and its close-out card; a Left card; the board's rows
with their facts; a life's mark on the Lineage page. It found two small
defects in Aski's room (a landed row shows backticks raw; "Reconnecting…"
moves the card in front), handed to the Cell at work there.

What was not proven, and so is still open:

- The phone's side of the previews and the chart fence was tested in
  code, never looked at on a device.
- A question's previews drew in the app only with previews edited into
  the page: the lab's provider asks questions without them.
- The nightly's Cell was never started by launchd against a running app;
  it stays off until someone opts in
  (`stemcells/scripts/install-nightly-sync --cell .`).
- The forms text shipped without its evals run
  (`stemcells/evals/forms.ndjson`): no model key was at hand. Two of
  upstream's cases that expect a rendered page for a comparison of
  numbers would now fail, by design.
- Marks show on the Lineage page only, for lives lived on this machine.

What we'd do differently:

- Research before building saved three items from being built at all
  (the receipt, the phone's rows, a guessed-at word count). Do it first
  for every item, not after the list is written.
- Six builders at once ran the plan's window dry and filled the disk;
  three, with one coordinator running every check and merge, landed more.
- A pull request opened before another one shrinks a list `drift` guards
  must take `main` before its check, or the gate reads the old list as
  growth.
