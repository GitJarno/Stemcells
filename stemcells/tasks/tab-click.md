# A click opens the tab

Clicking a Cell's tab sometimes did nothing at all, and once it did, it kept
doing nothing.

## Why

- A thrown Cell (W7c) took its carry out of the hand without ending it, so
  `carrying()` stayed true for the rest of the session. Every press on a
  Cell's tab then returned before anything happened. Aski's tab, which
  opens on a plain click, kept working. Gather and Undo Move, which wait on
  an empty hand, stopped too.
- A click that wobbled 4 px or more became a reorder. Let go in its own
  slot, that reorder changed nothing and opened nothing.

## The design, from what a click is

- **The click is the tab's own.** Carrying (reorder, tear off) is built on
  it and must never take it away. A press no carry takes (the new Cell's
  tab, unsent, or any tab while something else is in the hand) opens the
  tab on the press, as the new Cell's tab already did.
- **Let go in its own place, a press is a click**, however the hand
  wobbled on the way. A real reorder still only moves the tab.
- **Open on release, not on press**, for tabs a carry can take. The Mac's
  browsers open on press, but here a press can tear the tab off into a
  window. Opening it on press would slide the page in under the hand, then
  away to a neighbour at the tear, and the tear's still would catch a page
  halfway through its slide.
- **The page slides on the swipe's axis.** Tabs are pages side by side on
  one strip, and two fingers move along it. A click jumps along that strip,
  so it moves the way a swipe would, and the eye keeps where the pages are.
  A far tab comes in as the next page (the stand-in), so no turn passes
  pages on the way. Reduce Motion fades. All of this was already right.
- **A turn taken over mid-slide carries on at the strip's speed**, as every
  spring here does (`tokens/spring.ts`): a second click before the first
  lands no longer stops the strip dead and sets off again from rest. A
  turn back the other way still sets off from rest (`releaseVelocity`).
  It starts from the frame it took over in: a new animation waits for a
  frame to set off, and the turn's render held the strip still for three.
- The tab marks the click the moment the click lands, and the page
  follows on `page`. That is the acknowledgement; a marker gliding with the
  pages would have to follow a dragged chip too, which is more machinery
  than it is worth.

## Plan

- [x] A thrown Cell ends its carry (`ChatCarry.tsx`); test.
- [x] A press no carry takes opens the tab; let go in its own slot, a
      press opens it (`TabStrip.tsx`, `useTabCarry.ts`); tests.
- [x] The pager carries a slide's speed into a turn that takes it over,
      from the frame it took over in (`TabPager.tsx`); test.
- [x] Lab: the built desktop app, a Cell thrown, then tabs clicked.

## Review

- Each test failed on main for its reason: after a throw `carrying()`
  stayed true (and held the next test's carry off too), a wobbled click
  and a click with something in the hand opened nothing, and a turn mid
  slide moved 0.026 of a page in its first frame (0.07 now).
- Lab (the built desktop app in `stemcells/lab/electron`, a fake for
  every provider, a scratch home): four Cell tabs, a message sent so the
  draft became a Cell, the Cell thrown (its place stood empty, then it came
  home), then a click on another tab turned the strip onto that tab's page.
- The strip's place, sampled each frame through a click and a second click
  140 ms later the same way: with the speed carried but the new slide left
  to wait for a frame, it carried 3.5 pages/s into the takeover but stood
  still for three frames (222 to 255 ms) while the turn rendered. Started
  from the frame it took over in, it went on at 3.4, 4.0, 5.2 pages/s
  through the turn, with no frame standing still.
