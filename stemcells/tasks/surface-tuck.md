# A browser in a narrow pane tucks to its edge

In a pane a few hundred pixels wide, a Cell's floating browser (upstream's
mini player) lies over the chat's words: it is at least 240 px wide and the
chat has nowhere to step aside to. The Look chip naming the same browser
sits in the pane's buttons at the same time.

## What exists

- **Look** (`look-mode.md`): the focused Cell's workbench open, in a tab of
  two Cells or more, takes half the slate. That already is "comes out at
  half the screen".
- **The chip**: a Cell whose workbench is closed names its last surface in
  the pane's buttons (hover only); a click opens Look again.
- **The floater** (upstream): closing the right panel on a browser or device
  floats it over the chat (`closePreviewPanel`, every close path upstream
  has); an agent's browser can open floating. Upstream's canvas layout
  puts it beside the chat's lane where there is room
  (`resolveChatCanvasLayout`: lane padding + 640 + gaps + the floater) and
  over the words where there isn't (`overlapsChat`).

## Design

- One rule: **a floater floats only where it leaves the chat its lane.**
  Where upstream's own layout would lay it over the chat, it tucks: a card
  at the chat's right edge, standing on the Cell's shelf (the ledge's top),
  most of it behind the edge, its page's mark showing. Hover or focus
  slides it out to its name and ×; a click opens it in the workbench: Look
  in a tab of several Cells, the panel beside the chat in a tab of one, the
  sheet in a narrow window. × hides the floater; the browser stays among
  the workbench's tabs.
- Wide panes keep upstream's floater as it is.
- A tucked browser hosts no live view; its card keeps the recording dot.
- The way back: every way out of Look floats a live surface again, as
  upstream's own close does, so a browser opened from its card returns to
  it. The chip stays away while the surface it names floats or is tucked.

## Plan

### PR 1: the tuck

- [x] Adapter `upstream/floater.ts`: whether the floater would cover the
      chat (upstream's layout), its face (name, page, recording), open in
      the panel, hide
- [x] Substitute `ThreadPreviewMiniPlayer`: tucked or upstream's
- [x] `surfaces/Floater.tsx` + `tuck.css`: the card on the shelf
- [x] Contract test: upstream covers the chat in a pane's width and not in
      a wide one; opening lands it on the panel's tab and ends the
      floater; the chat draws no floater for the browser its panel shows
- [x] Prove it in the dev app: a narrow-pane tab with a floating browser,
      before and after; open → Look; × hides

### PR 2: the way back

- [x] Look's endings float a live surface again (upstream's close)
- [x] The chip stays away while its surface floats or is tucked
- [x] Prove it: card → Look → its × → card

## Review

### PR 1

No upstream file changed (`drift`): a substitute for upstream's mini
player decides, from upstream's own canvas layout, whether it floats.
Headless, the web dev server on a copy of real data, a server browser:

- Before: in a tab of seven Cells (220 px panes), the floater covered the
  Cell's last reply from its middle to the composer.
- After: the reply reads whole; the card's mark peeks at the pane's right
  edge, its foot on the Cell's floor. Pointed at, it slides out to its
  page's title and ×. A click opened Look: the Cell and its browser half
  and half, the other Cells on the rail. × ended the floater (none left in
  upstream's store) and the card went.
- One full pane (1530 px) still floats upstream's player beside the chat.
- Pointed at in a 220 px pane, the slid-out card covers the Cell standing
  on the shelf until the pointer leaves.

Review fixes (an independent read of the change):
- Whether a chat tucks is asked of the canvas alone, at a floater's first
  size: a floater the person resized over the chat in a wide canvas (which
  upstream allows, stepping the chat left) no longer turned into a card
  under their hand mid-drag.
- Touch has no hover: the first tap brings the card out to its name and ×,
  the next opens it (upstream's floater shows its buttons on a tap).
  Proved with a touch context: tap one, out and no Look; tap two, Look.
- Out, the card stands 8 px clear of the edge; that gap counts as the card,
  so a pointer resting in it no longer sent the card in and out (2 s at the
  edge: still).
- The card's foot follows a new chat's composer too, which stands mid-canvas
  in an overlay that never resizes.
- No motion when it comes or goes: a chat narrowing past the room for a
  floater swaps one for the other at once.

### PR 2

Look's endings close a Cell's panel as upstream's every close does
(`closePreviewPanel`): a browser or device it showed floats on, and in a
narrow pane that is its card. The contract test pins upstream's close
and fails on main for ours. Headless, same chat in seven panes: the card,
no chip; a click, Look; the workbench's ×, the card back and still no
chip; × on the card, the card gone and the chip naming the browser back.
Esc didn't end Look there, with or without the card: a closed popover
the Cell's line keeps mounted counted as open (its own fix).
