# The project's mark leads the title

The person, 2026-10-30: on the phone they look top left to see which project a Cell is in,
then read its one-liner, but the mark stood at the card's bottom right. Asked to decide, from
first principles.

## Decision

The project's mark is the title's first glyph, inside its text: on a card, on a settled slim
row, and before the one-liner under a Cell's name in its chat's header.

- **Where before what.** A list of Cells is scanned down its left edge, then read along each
  first line. The project is the key the person sorts by ("which of these are the shop's"), so
  it belongs where every row is scanned, not in the corner read last.
- **No column.** The mark takes room on the first line only; a second line runs under it. The
  title's left edge before decision 4 of `phone-polish.md` cost every line 28 points; this costs
  one line 23.
- **Hierarchy holds.** The Cell (who) stays large on the left, the mark (where) is the size of
  the title's capitals, the title (what) is the text. Sizes, not positions, keep them apart.
- **One grammar.** The card, the settled row and the chat's header all read "mark, one-liner",
  so the mark means "where" wherever it shows. The bottom right keeps only the machine and the
  pull request: state, not place.

Left alone: a home narrowed to one project still shows the mark on every row. Hiding it there
is a refinement for later, if the repetition reads as noise.

## Plan

- [x] `RowCell.tsx`: the mark as the title's inline lead (`cardLines().lead`, `SlimRowProject`),
      out of the bottom-right marks
- [x] `thread-list-v2-items.tsx` seam: the lead inside the title's text, card and slim row
- [x] `chat/CellTitle.tsx`: the mark before the one-liner
- [x] `seams.md`, `phone-polish.md` decision 4
- [ ] On the phone, with the next build
