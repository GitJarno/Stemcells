# A swipe turns the tab wherever the pointer rests

The person: swiping between tabs, the pointer stays where it was and the
page that lands may put a picture or a visual under it. From there no
swipe turns the tab: whatever is under the pointer takes it.

## Plan

- [x] Find what takes the swipe, with a real wheel in a browser
- [x] A frame under the pointer
- [x] A box that keeps its overscroll
- [x] The terminal
- [x] A focus's own scroll still goes back

## What took it

Three things, each shown with a real wheel event before its fix
(`TabPager.browser.test.tsx`, through the DevTools protocol; a made-up
`WheelEvent` goes where the test sends it and shows none of this).

- **A frame.** A visual a Cell draws in a chat is a sandboxed frame. A
  wheel over a frame is the frame's: the page round it hears no wheel
  event, and the proxy still scrolls, the frame having nowhere to go. The
  strip takes a scroll for the fingers' only after a wheel event, so it
  put the proxy back, every frame of the swipe. Now a scroll with no wheel
  event is the fingers' when the pointer is over a frame (`overFrame.ts`).
  Hover cannot say so alone: a page that slides under a pointer at rest
  changes no hover until the pointer moves, which is the case reported. So
  the strip keeps where the pointer was last seen and asks what is under
  that point now. The swipe's rules count a touch by its wheel events, so
  each scroll event stands in for one.
- **A box that keeps its overscroll.** Chromium now lets no scroll out of
  a box with `overscroll-behavior: contain`, even one with nothing to
  scroll that way. Upstream's `overscroll-contain` is on the composer's
  row of pictures and on a panel's list; `proxy.css` already handed the
  swipe on from upstream's scroll areas, and now does from these.
- **The terminal.** It cancels every wheel that moves up or down at all,
  as each wheel of a sideways swipe does a little. A wheel more sideways
  than not goes past it (`pageStrip.ts`); it reads only how far a wheel
  moves up or down (`upstream/terminal.contract.test.ts`).

A scroll the fingers did not make still goes back, pointer over a frame or
not: a focus or a key marks the frame it happens in, and that frame's
scroll events come before the mark is cleared.

## Left as they are

- The browser in a pane: its wheel is the page's inside it, which may
  itself be wider than the pane.
- A wide table or code block: it scrolls first, as the browser has it.
- A pointer that went into a frame, moved on inside it, and then had
  another page with a frame of another shape slide under it: the page
  hears nothing of a move inside a frame. Hover, as of the last move, still
  says a frame, so the swipe is taken for the fingers'.

## Review

Each cause failed its test on `main` and passes now; the frame's was also
run against `main`'s strip alone to see it fail there. Not done: a pass in
the desktop app with the trackpad, where the system's scroll phases join
in; the stand-in wheel events are what its rules about touches would see.

What I'd keep: test a swipe with a wheel the browser routes. Every
earlier swipe test dispatched its own `WheelEvent` at the proxy, which is
the one thing none of these three lets happen.
