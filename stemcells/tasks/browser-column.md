# A chat's browser beside it, and a finger that drags

The use: a chat on the left, the page it's building on the right, at a
phone's size or a desktop's, touched and tried while the chat iterates.

## What was wrong

On a phone, a remote client of the Mac, a Cell opened a page in the server
browser and sized it to a phone preset. "One tab open" opened it full
screen, and after Take control the page "did nothing".

Reproduced in a lab with the same setup: a desktop-hosted tab, opened by a
(fake) agent over MCP and still owned by its turn, at `iphone-14-pro-max`.
The phone's viewer ran in Chromium and WebKit touch engines, and on a
simulator. Taps and scrolls did reach the page. **A drag never did**: past
an 8 px slop, every finger movement became wheel scrolling
(`preview-stream.browser.ts`, and the same in the web's
`ServerBrowserSurface.tsx`). A page driven by sliders reads as dead. The
literal "taps do nothing" never reproduced; a slow dev page that is still
loading is the likely rest of it.

## Upstream (T3) and us

- T3's phone has the inspector column (`useOpenThreadInspector`) that the
  Device panel and local previews use, and `BrowserChrome` already has
  `inPane` and `onMaximize`. The browser tab alone never used the column:
  its pill and button push a full-screen route. Same on `upstream/main`.
- T3's touch viewers (phone and web) scroll on every drag. Same upstream.

Our delta, smallest first:

1. **Column.** The inspector target takes `"browser"` (two seams); two
   substitutes (`browser-preview-button`, `ThreadBrowserFloat`) open it
   beside the chat in view (`stemcells/upstream/browserColumn.ts`) and fall
   back to upstream's route where no chat is in view. No edit to the hot
   `ThreadDetailScreen.tsx`. Maximize goes to upstream's full-screen route
   on the same tab.
2. **Drag.** The touch probe the viewers already send on pointerdown (is
   the point editable?) also asks whether the point takes a drag: a range
   input, `draggable="true"`, or `touch-action: none` up the tree, which a
   page sets on what it drags itself (`apps/server/src/stemcells/browser/dragProbe.ts`).
   There a finger is a mouse drag (move, down, held moves, up); elsewhere it
   scrolls. If the answer hasn't come when the finger passes the slop, the
   viewer waits up to 250 ms, then scrolls.

Tradeoffs: the drag change sits inline in two upstream viewers (not hot:
8 and 18 commits in 90 days) because it lives in their pointer handlers'
state; a substitute would copy both files whole. It is a fix any T3 user
wants, so it is the first thing to offer upstream if the person asks. A
page that drags with plain mouse events and no `touch-action` still
scrolls under a finger; a two-finger gesture is the obvious next step if
that matters.

## Plan

- [x] Reproduce in a lab; find the root cause
- [x] Column on the phone (substitutes + inspector target)
- [x] Probe answers `drags`; phone and web viewers drag where it says so
- [x] Web test that fails on the old code (`browserTouchDrag.browser.test.tsx`)
- [x] Simulator pass on a Duo: column opens beside the chat, scroll and
      slider drag work, Maximize goes full screen

## Review

Done. Control is held per viewer, so Maximize (a new viewer) asks to take
control again, as reopening a tab does upstream. The server's recording
tests fail on this Mac with or without the change.
