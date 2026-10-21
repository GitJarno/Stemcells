# A Cell forming on its line

The spawn's last beats (`stemcells/docs/interaction.md`): in a new Cell's
pane the words' stream condenses into glyphs over the Cell's box, then the
Cell takes over: its outline in blocks, its own pixels, a crouch and a hop
onto its line. Three owners play one sequence: the words, Aski, and the
Cell. This is the Cell's part and the timeline they share.

## Plan

- [x] One timeline and one set of motion tokens, agreed with the words'
      and Aski's owners: `letter-stagger`, `letters-span`, `spawn-stagger`,
      `form-step` (one beat of the sprite clock) in `tokens/stemcells.css`.
- [x] The spawn in `stemcells/docs/interaction.md`.
- [x] `formAt(threadId, at)` and `cellBoxOf(threadId)` (`cell/forming.ts`):
      the hand-off, on `performance.now()`, held to 3 s ahead at most.
- [x] The blocks from the Cell's own crouch, lit in a Bayer order, in its
      body's colour; `form/hop` in `art/moves/form.json`, inside the box.
- [x] The composer line's Cell plays them (`CellMark` with a stage,
      `CellFigure`'s `forming`); its box carries
      `data-stemcells-cell-box`. No new props on `CellMark` or the line.
- [x] Nothing waits: no call leaves the Cell standing, Reduce Motion forms
      nothing, the composer takes typing throughout.
- [x] Tests: the order of the parts, the blocks fill the outline in one
      ink, the hop's box, the 3 s hold, `form-step` on the sprite clock.
- [x] A lookbook strip at 2x, dark and light (`cell-forming.png` in the
      pages folder), and a dev-app run: a draft sent, its box empty, the
      blocks, the hop, then its mood, dark and light.

## Review

The Cell forms in its box on the composer line from blocks, then hops onto
it, and stands in its mood after about two thirds of a second. In the dev
app a draft sent with a hand-off five steps after its line appeared played
empty, blocks, hop and mood in both themes, and words typed 275 ms after
the line appeared, before the hand-off, landed in the composer. Aski's
beats are in the timeline too, on the tokens it already had.
