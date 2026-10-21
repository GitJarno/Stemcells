# A Cell's buds are its Subcells

The buds beside a Cell on the composer's line (`cell-buds.md`) were bare
copies of the Cell: its body, small, in its colours. Each one stands for a
Subcell at work, so each is now drawn as that Subcell, the way the
transcript draws it (#156): dealt by its thread id, small, with its status
for a face.

## Shape

- **Data.** `useCellBuds` names the Subcells, oldest first, instead of
  counting them. Each one comes with its name, its provider and its status.
  - A subagent item is named `childThreadId ?? subagentId`, as its mark in
    the transcript is.
  - A delegating call is named by its item id.
  - A subagent at work in the background is named `childThreadId ?? taskId`.
    When a turn hands its subagents to the background, each bud stays the
    same Subcell.
  - Items in any status are included, so a bud waiting to go home shows how
    its Subcell ended.
- **Row.** `BudRow` tracks buds by name, not by count.
  - A Subcell's bud steps out as it starts, if there is room (two at most).
  - Its bud goes home 3 s after its Subcell stops working, the same stay as
    before.
  - The bud scenes in `work.json` still set where each bud stands, steps
    and hops. Their layers' places are read, and the blob art is not drawn.
  - When the newest bud goes home, its step out plays backwards.
  - When the older bud goes home, it walks behind the one that stays, then
    behind the Cell. The two legs of `bud/out/2` play backwards.
  - A bud that has ended keeps its last known face. With no newer status,
    that is its last one.
- **Drawing.** Each bud is a `SubcellMark` at half the Cell's points, in its
  own provider's colours, with no status dot. The stage keeps its box and
  place, so the line's layout does not change.
  - Buds that are stepping are drawn under the rest, and the Cell is drawn
    over all of them.
  - Reduce Motion stands the buds at once, held still.

## Plan

- [x] `buds.ts`: `Bud`, `BudPlace`, a `BudRow` that knows buds by name, and
      places read from the scenes' layers
- [x] `cellWork.ts`: `budOf`, `budsIn`, and `useCellBuds` returning
      Subcells
- [x] `CellBuds.tsx`: a `SubcellMark` per bud at its place; `points` on
      `SubcellMark`
- [x] Tests: the row (out, home newest, home older, stay, cap, Reduce
      Motion, face kept) and the contract (names match across the hand-off)
- [x] Proof: a real run with 2 Subcells, in dark and light, in a narrow
      pane, and with Reduce Motion

## Review

Three runs on a real Claude Cell, each with two Subcells. The proof image is
in the session's pages folder.

- Each bud wore the deal of the same Subcell in the transcript, by the same
  thread id. Every run dealt new looks: pumpkin and ghost, then duck and
  kabuki, then pumpkin and propeller.
- **Stepping out.** The first bud stepped out from behind the Cell, at
  x −10 → 0. The second stepped out under it while the first moved over,
  at 0 → 12.
- **Faces.**
  - Both thought while their Subcells worked.
  - A Subcell that ended stood awake through its 3 s stay.
  - A waiting Subcell wore the "?".
- **Going home.**
  - The older Subcell ended first. Its bud walked home behind the newer one
    (12 → 0 → −10), and the newer bud kept its place.
  - The newer bud then went home 3 s after its own Subcell ended.
- **Dark, light and narrow.** All three hold the same row. On light, the
  ghost's pale pieces are keylined. A 560 px pane changes nothing on the
  line.
- **Reduce Motion.** Both buds stand at once, held still.
- **The compiler.**
  - The React Compiler keyed `useCellBuds`'s result on the turn items, so a
    list rebuilt from text there still changed as items streamed.
  - The stage now keys its effect on the Subcells' text instead. It looks
    again only when a Subcell changes.
- **Follow-up, not in this PR.** The transcript's group header gives
  Subcells no status when there are two or more (upstream drops the dot).
  Its marks stand awake while the buds think.
