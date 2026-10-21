# A new Cell past the last tab

Two fingers swiped past the last tab bring a fresh new Cell's page, ready
to write in. Enter starts the Cell, and the page becomes a normal tab.
Swiping back without sending takes the page away with no trace, and any
words typed stay in its draft for next time. Aski's end, on the left,
keeps its rubber band.

## Shape

- The new Cell's draft is made ahead, with no route to it. It is filed
  under its own key in upstream's draft store (`stemcells:new-cell`), so
  the next swipe, or a reload, finds it again with its words. The draft is
  made from upstream's own pieces for a new thread: the project a new tab
  gets, the env mode, runtime mode, the model carried over, and sticky
  state (`upstream/newCellDraft.ts`). `newCell.contract.test.ts` pins
  upstream's new-thread steps.
- The workspace store holds the new Cell (`NewCell`: its ids and draft),
  in memory only. The pager gets its page as the last page, so the strip
  follows the fingers onto it one to one. Past it, the strip rubber-bands.
- Landing on it, by a swipe, a click, or a route to its draft, takes it
  into the workspace as the last tab, routes to its draft, and the
  composer takes focus (ChatView focuses when it gains the input).
- While it is still bare (one pane, its draft unsent), it is never stored.
  Leaving it (any turn away) takes it out of the workspace again; the page
  stays as the strip's last page. Its draft is never dropped.
- Sent (the draft promoted), or changed (split, another chat shown): it
  becomes a normal tab, and a new one is made, off the main path.
- The tab bar shows its tab only while its page is on screen. The pager
  drives that tab's opacity and width from the strip's position each
  frame, and animates them alongside the strip's slide with the same
  spring.

## Plan

- [x] `tabs/newCell.ts`: pure take / leave / stored / became-real, tests.
- [x] `upstream/newCell.ts`: make, find and watch the new Cell's draft;
      contract test.
- [x] Store: `newCell`, leave on every update, never stored while bare.
- [x] `CellWorkspace`: the page, the turn, the route, the draft kept.
- [x] `TabPager`: the new Cell's tab in the bar follows the page.
- [x] `TabStrip`: the new Cell's tab.
- [x] Tests: replayed swipes at the right end (single, alternating,
      flick, slow, short) turn one page each.
- [x] Dev app (lab window off every screen): the matrix at the right end,
      a position plot, typing after landing, the words kept after leaving.

## Review

The lab ran the built web app in an Electron window placed off every
screen, with phased trackpad streams posted to its process only. The strip
had five tabs, then the new Cell's page.

- The matrix at the right end: 54 runs, from the last tab onto the new
  Cell and back. It covered single, alternating, on-on-back-back, slow,
  paused, short and hard swipes; quiet, the page busy 120 or 250 ms at each
  turn, and the UI thread held 100 to 180 ms. Fast alternation ran 220 and
  300 ms apart. Every run turned the right pages and ended on the right
  page, with 0 px past a target after any release. Short swipes followed
  0 px of coast. The one excursion past a page was the rubber band past the
  new Cell: it followed the fingers' own moves, which a held UI thread
  delivered late (31 px), and sprang back with no overshoot.
- Frames on the 120 Hz screen, quiet runs: drag p95 8.5 to 9.3 ms. Release
  p95 9.1 to 9.3 ms, with one 33 to 41 ms frame where a turn renders, as
  any turn has.
- Position plot: the new Cell's tab follows its page frame for frame.
- Landing focuses the composer, and typing works at once. Words typed came
  back on the next swipe past the end, and after a reload. A reload while
  on the new Cell reopens it. The stored tabs never held it while it was
  bare.
- Split with ⌘D, it became a Cell's own tab: stored, kept when left, its
  words filed under its pane. A fresh new Cell was made past it.
- Aski's end still rubber-bands (40 px for a 160 px swipe).
- A real send was not run live, because it would start a model turn on a
  real account. The send path is tested against upstream's real draft
  store (`upstream/newCell.test.ts`).
