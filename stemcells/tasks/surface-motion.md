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
- The cut keeps still; only the page moves (follow-up to #88). While the
  pages move, the view stays where it was placed and is cut to the pages'
  frame by a fixed `clip-path`; its first box, holding the webview, moves
  inside it. #88 moved the view and animated a cut on that box. Each ran on
  the compositor, but the cut ran about a frame behind the move, so at peak
  speed the leaving page showed up to 40 px over the rail (3 of 4 runs).
  A cut that doesn't animate can't lag, and the percent cuts and the keys
  where a slot crosses the frame's edge went with it.
- The tabs code doesn't name surfaces: the ride watches `data-moving` on
  `[data-stemcells-pages]`, as the pager documents.
- The arriving page brings its Surface's frame, not its surfaces. Off
  stage, the focused Cell's panel keeps its frame and tabs in its page's
  workbench, inert, holding nothing: the page comes in at the width it
  lands at, its chat doesn't jump at the turn, and no live browser runs off
  stage (the launch rule). What the panel shows comes with the stage and,
  while the pages move, fades in on `fade`: the DOM by `@starting-style`,
  the browser by a fade on its view. Look's stand-in went with it: every
  page has the frame now.

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

### Follow-up: the cut keeps still (2026-10-21)

Re-captured with the dev app off screen: its windows are shown once at
zero opacity and hidden, and keep rendering hidden (a preload outside the
repo). The CDP screencast draws the browser guest.

- Before (main after #88), 4 runs of left-right-left between two Cells with
  live browsers: 3 runs drew a browser over the rail, in 15-22 frames each,
  by up to 40 css px. All during the slide whose leaving page exits left.
- After, 4 runs: no frame draws a browser over the rail. In the two runs
  between the browsers' tabs, 423 of 427 frames with a browser on screen sit
  33 to 34 device px from the Surface header's mark, as at rest. The other
  four: two frames where a browser first appears at the turn (30 and 31 px),
  and two where the edge finder misread.
- Still open: the arriving page shows its browser only once the turn mounts
  its Surface (about 250 ms with no browser on the page). Next PR.

### Follow-up: the arriving page brings its Surface (2026-10-21)

- Off stage, the focused Cell's panel keeps its frame and tabs, inert and
  empty, so the arriving page slides in at the width it lands at. Its
  surfaces come with the turn and fade in on `fade`: the DOM by
  `@starting-style` while `data-moving` is on, the browser by a fade on its
  view, started the moment upstream shows it (the ride watches the views'
  host as well as the pages), so it never paints once whole first.
- Two ride bugs the fade brought out, both fixed: the ride took any running
  animation above the slot for the slide, and copied the surface's fade
  instead, holding the browser still beside its page for 200 ms; it now
  takes only the strip's. And a slide that only fades (reduced motion) was
  copied as a move to no offset, throwing the browser a page off its slot;
  a key without a transform now leaves the strip where it is.
- Proof, hidden dev app, left-right-left between two Cells with live
  browsers: in all 813 main-thread frames with a browser shown, it sits
  within 0.5 px of its slot; no frame draws a browser over the rail; every
  page's composer keeps one rect from start to end (before: the arriving
  chat jumped narrower at the turn). Reduced motion: the same, the browser
  fading in where it lands.
