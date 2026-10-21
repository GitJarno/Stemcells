# Borders that resize

Side-by-side Cells share their row by dragging the border between them;
a double-click on a border makes its row even. The same goes for stacks
and rows (heights), and for the edge between the chats and the workbench.

## Plan

- [x] One splitter (`split/`): a pure model (two neighbours move, floors,
      a detent at even, nudges) and one separator (hit zone, grip after a
      beat, drag, double-click, keys, ARIA) over `Sides`, what a border
      moves however its neighbours are laid out
- [x] Shares in the layout: each row, column and pane carries its share
      of its parent; a newcomer takes an even share, a closed pane's room
      goes to its siblings by their shares; kept across reloads
- [x] The grid draws its borders as separators, and grows each child by
      its share
- [x] Double-click or Enter: the row glides to even on `settle`; Reduce
      Motion snaps
- [x] A swipe never starts during a border drag
- [x] Transcripts hold still while a border moves sideways, and re-wrap
      once it rests (`rewrap-rest`) or is let go
- [x] Prove it: frame strips of a drag and a glide (2 and 3 panes, side by
      side and stacked), a perf trace
- [x] Our `:has()` rules off the grid, page and pane: they restyled the
      whole grid whenever a composer folded its controls (in this PR after
      all: without it a drag across a composer's width steps drops frames)
- [x] What a frame of a drag or glide restyles, pinned (`restyle.test.ts`)
- [x] A soft detent at even; a swipe or a tab carry never starts on a
      border; a glide keeps the pointer it left
- [x] Review fixes: shares read at a mean of 1 (a closed or carried Cell
      left the rest filling part of the row); a moved pane arrives with an
      even share; a newcomer beside others takes its room from what they
      have over the floor, or stacks; the press moves nothing; Escape puts
      a held border back, the window's blur lets it go; gone mid-drag or
      mid-glide it lets go of what it held still; a double-click whose
      press dragged isn't one; a missed pointerup lets go; a press over a
      Cell while a glide keeps the pointer goes to the Cell; the Cell's
      pill shows while no composer is drawn
- [x] Re-review: a press passed on to a Cell gives it the page's own click, so the row hears one; the release listener goes on cancel, blur or after 5 s; a chat dropped beside a Cell takes its room as ⌘D's newcomer does, or stacks with the Cell it was dropped on
- [ ] The workbench's edge on the same separator, proven beside a live
      browser in a desktop lab (its own PR)

## Decisions

- A border takes no room: it is a flex item 8 px wide with −4 px margins,
  over the hairline its neighbours already draw, so nothing in the grid
  moves for it. Its neighbours are its element siblings and grow by their
  shares (`flex-grow`), so they keep their proportions as the window
  resizes, and a drag lays them out frame by frame without a render: only
  their grow changes, and the layout keeps the lengths on release.
- Only the two neighbours of a border move; the rest of the row keeps its
  lengths. Even is the one detent, and a soft one: within 6 px of the two
  neighbours being equal the border holds there, and over the next 14 px
  it eases back under the pointer (`detent` in `split.ts`), so it never
  jumps. An arrow key that would cross even stops on it.
- Floors: 160 px wide (`MIN_COLUMN_WIDTH`), 240 px tall for a pane
  (measured: at 200 the pane's buttons sat on the line over its composer),
  and a row as tall as its tallest stack allows. A window too small for
  them squeezes Cells as before; the floors bound drags and keys only.
- A newcomer has no share and takes the mean of its siblings', an even
  part; a closed Cell's room goes to the rest by their shares (flex does
  it). Shares are kept at a mean of 1 when written.
- A long chat dragged across a border re-wrapped and re-measured every row
  each frame: 92 of 187 frames drawn in a dev trace. While a border moves
  sideways, the transcripts on either side keep their width and lanes,
  clipped at the border (the one after it anchored to its far edge), and
  re-wrap once the border rests 120 ms (`rewrap-rest`) or is let go. The
  composers follow the border all along. Moving up and down re-wraps
  nothing, so stacks and rows don't hold still.
- A row gliding to even holds every transcript in it still until it lands
  (`settle`), for the same reason. Where a long chat read to its end
  re-wraps, upstream's list shows one frame scrolled short before it
  re-measures; a one-step window resize shows the same frame, so it is
  upstream's, not the border's: on the web `@legendapp/list` applies a
  row that shrank a frame late (`shouldDeferWebShrinkLayoutUpdate`), and
  every row of a widened chat shrinks. Each Cell anchors to the edge that
  moves the less toward even (`evenAnchors`). The pane's own hold keeps the end
  (`keepEnd.ts`, 600 ms, longer than the rest and the glide).
- The cursor during a drag is worn by a veil over the page, not by a rule
  on every element: that rule restyled the whole page at the press (35 ms
  on a long chat).
- What a drag or glide marks restyles only what it names. A `:has()` on the
  grid, a page or a pane restyled all of it at any change in a chat (a
  composer folding its controls at a width step: 2,260 to 2,781 elements,
  20 to 30 ms); the page now sets what they looked for as attributes. The
  transcripts' held width was an inherited custom property, restyling
  every row of a long chat at the press (3 × 1,838 elements, 25 ms); it is
  registered not to inherit. The glide's rule was `> *` (2,839 elements,
  17 ms at each end); it names the shares.
- A Cell the pointer enters restyles all of itself (upstream's Tailwind
  group hovers, about 2,200 elements, 13 ms). A border gliding to even
  would leave a resting pointer in a Cell mid-glide, so while it glides it
  reaches over its row and keeps the pointer until the pointer moves,
  presses or scrolls, or the glide lands.
- The grip is the `grip` token, brightening to `grip-active` while held or
  focused, a beat (`beat`) after the pointer arrives, where the pointer is
  along the border.

## Review

Dragging, gliding, keys and floors work in the dev app at 1440×900 with
2 and 3 panes side by side and stacked; widths come back after a reload.
Production build, 3 Cells over a long chat, a 3 s drag at 120 Hz input
(headless, 60 Hz frames, load average 65 from other sessions): 178 of
180 frames drawn, 1 dropped. The slow frames left (15–20 ms) are where a
composer folds or unfolds its controls at a width step: our `:has()`
rules anchored on the grid, page and pane make Chrome restyle the whole
document then (3359 styles); with them rewritten the step costs under
3 ms. That fix is the next PR. The browser beside a dragged border needs
the desktop lab, which the workbench edge's PR brings.

Second pass (2026-10-21), the desktop lab (Electron, never shown, 120 Hz,
DPR 2), production build, load average 18 to 35 from other sessions: a
real-mouse drag over 3 s (2 panes, 3 panes, stacked) and a double-click
glide of each, traced. Main-thread frame median 5 to 6 ms, p95 7 to 9 ms;
1 to 5 frames dropped of about 360 per drag and 1 to 2 per glide. The
border follows the pointer to the pixel; a 3-pane drag moves only its
two neighbours. What still drops a frame is upstream's: the composer
refitting its controls at a width step (its ResizeObservers, 5 to 13 ms),
the re-wrap where a drag is let go or a glide lands, and the frame
`@legendapp/list` shows a widened chat short. Frame strips, the perf
summary and two traces are with the PR's proof.
