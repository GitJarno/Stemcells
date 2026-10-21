# Surfaces in motion: the browser rides its page

A browser in a Cell's workbench misbehaves when the slate moves:

1. On a two-finger swipe between tabs, the browser can't keep up: it is
   left half-hidden at the edge of the page it was on.
2. Dragging the workbench's width with a browser in it shakes the layout
   left and right (fixed in #91: the panel's cap measures the tab's page).

## Causes (proved in the desktop dev app)

- The desktop browser is an Electron `<webview>` that lives once for the
  app (`HostedBrowserWebview`, at the app root), fixed at the rect its slot
  in the panel last presented (`BrowserSurfaceSlot`: on resize and scroll
  only). A page sliding moves its slot by a transform, which resizes
  nothing, so the browser stays where the page was. A slot that mounts
  mid-slide presents where the slide is then, and nothing places it again
  once the strip rests: after a click turn, main draws the browser half
  under the rail while its Surface sits empty at the right.
- The tab turns while its pages slide, and the page leaving dropped its
  Surface at once, halfway across the screen.

## Plan

- [x] Reproduce on main with a live browser in two Cells (frame captures)
- [x] The browser follows its slot while the pages move (`data-moving`,
      from the pager), without React: a transform on the view, its page's
      box cut to the pages' frame
- [x] A slide runs on the compositor, so the view gets copies of it with
      the same timing and start; the fingers' strokes are followed in the
      frame the pager writes them
- [x] At rest the slot presents where it is and the transform goes
- [x] The page a turn leaves keeps its Surface until the pages rest
- [x] One registration: a substitute for `BrowserSurfaceSlot`, so every
      slot rides (`substitutes/BrowserSurfaceSlot.tsx`)
- [x] Contract tests for what the ride leans on upstream for
- [x] Prove it in the dev app: left-right-left swipe, a width drag held
      and released, reduced motion

## Decisions

- Ride, don't hide. Moving an out-of-process guest is the compositor's
  work; it paints again only on a resize. The earlier draft (#88) hid the
  browser behind a stand-in while anything moved; riding keeps the page
  on screen and needs no stand-in.
- The move and the cut sit on two boxes: the view moves, its first box
  (holding the webview) is cut. Chromium draws a cut on the compositor only
  while the same box isn't also moved there; on one box, a turn's busy main
  thread left the cut behind the move and the page showed over the rail.
- Cuts are in percent: a composited animation of a cut in pixels draws
  half of it on a 2x display.
- Where a slot's edge crosses the pages' edge mid-slide, the copies get a
  key of their own there, so the cut stays exact through the kink.
- The tabs code doesn't name surfaces: the ride watches `data-moving` on
  `[data-stemcells-pages]`, as the pager documents.

## Review

- Swipe left, right, left between two Cells with live browsers: in every
  frame with a browser on screen, it sits within 0.5 px of its Surface's
  header, through finger strokes, the slide, the turn's busy main thread
  and the spring's tail.
- The page leaving rides out whole; the page arriving shows its Surface
  once the turn mounts it (about 150–300 ms into the slide): a Surface
  mounts only on the page on stage. Mounting the arriving page's earlier
  needs a live browser in an off-screen tab, which the launch fix argues
  against; left for a call.
- Width drag over the browser, held 3 s, released: the page reflows with
  the edge every frame; nothing moves while held; release shifts nothing
  but a half-pixel rounding.
- Reduced motion: the strip cuts and fades; the browser fades with it.
