# The slate: one content panel, Cells side by side, swipe between tabs

The chat area becomes one rounded slate on a black frame: the left column
and the tab strip are the frame, the slate holds the active tab's Cells side
by side or stacked, and a two-finger swipe on the slate travels between tabs,
riding the fingers.

## Plan

- [x] Research: how upstream's chat area depends on width and on its right
      column; where upstream is heading (report outside the repo)
- [x] Design: where to ride upstream and where to drift, from first
      principles (this file, "Design")
- [ ] Paint through upstream's theme system: a Stemcells theme (black chrome,
      gray canvas) published as an environment theme, set as the default
- [ ] Slate geometry: tab strip on the frame, the slate below it (8 px
      gutters, 12 px corners, one quiet inside edge), the tab on stage joins it
- [ ] Panes inside the slate: 1 px hairline rules, rounded only at slate
      corners; header and composer float over the transcript
- [x] Width: each pane lays out by its own width, not the window's (lane padding)
- [x] Right column with panes: one workbench per tab, the focused chat's surfaces
- [ ] Swipe: neighbour tabs stay mounted; 1:1 tracking on the compositor,
      rubber band at the ends, 110 px commit, page spring, latest input wins,
      horizontal scrollers keep their own gestures
- [ ] Prove it in the real app (dev server in a browser, then the desktop build)

## Design

How the work is actually done: two to four chats live at once (p90 4),
usually one project at a time but two or more in 42 % of minutes; columns,
not stacks; diffs and pull requests in half the sessions, a browser in one
in ten. Upstream's unit is right: a thread and its surfaces (terminals,
browser, diff, files, pull requests) belong together, because they act on
that thread's folder and branch. Upstream has declined split panes, so
showing several threads at once is ours to carry.

- A tab holds threads as columns (stacking stays, columns come first). A
  two-finger swipe travels between tabs.
- One workbench per tab: upstream's right panel, docked at the slate's
  right edge, showing the focused thread's surfaces. Focusing another
  thread shows that thread's surfaces (upstream keeps them per thread, as
  it does when switching threads in the sidebar). A tab with one thread
  looks and works exactly like upstream.
- Paint goes through upstream's theme system: a Stemcells theme (black
  chrome and sidebar, gray canvas) published as an environment theme and
  set as the server default only when none is chosen.
- Seam: the focused pane's `ChatView` renders its panel into the slate's
  workbench node; other panes render none (a context, like
  `ChatWindowInputContext`). The panel toggles show for the focused pane
  only; find and the timeline's scroll keys act in the focused pane only.
- Width: a pane's padding follows the pane (container queries in our
  sheet); upstream's 980 px inline/sheet switch reads the window, which is
  right once the panel sits at slate level.

## Review
