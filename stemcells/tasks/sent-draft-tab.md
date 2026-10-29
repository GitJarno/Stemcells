# A sent Cell's tab renames again

Double-clicking a tab's name stopped opening it for every Cell started in
the app since the 2026-10-28 sync. Cells started elsewhere still renamed.

## Why

- Upstream (#25615, "drafts promote from the draft store, not from route
  effects") now lets a sent draft go first, then its view of the draft's
  route moves the route on to the thread. Before, the route moved while
  the draft was still held.
- Our route reading drops a draft the store no longer holds, and our pane
  showed the thread directly once listed. So no view of the draft's route
  was left to move the route on, the pane held the draft for good, and
  every gate on `draftId === null` refused it: rename, the pane's grip,
  settling.
- Those Cells are stored with their draft ids, so they stay stuck after the
  fix unless repaired.

## Plan

- [x] A pane whose draft upstream let go once sent renders the draft's
      route, so upstream's view moves the route on and `showRoute` gives
      the pane its thread (`useCellPresence`); browser test.
- [x] At start, a pane's draft upstream no longer holds is its thread
      (`goneDraftsAsThreads`); unit test.
- [x] Contract: upstream's draft route view follows the redirect.
- [x] Lab: the desktop dev app, fake providers.

## Review

- Both tests failed on main for their reason: the let-go draft read
  `unknown` with no route, and the repair didn't exist.
- Lab (`stemcells/lab/electron dev`, fake Claude, scratch home): on main, a
  draft sent from a new tab left the URL on `#/draft/<id>` and the tab
  refused rename. With the fix the URL moved to the thread and the tab
  renamed. A stuck draft id planted on an inactive tab: with the repair
  off, activating it routed to `#/draft/draft-planted` and rename refused;
  with it on, it routed to its thread and renamed.
