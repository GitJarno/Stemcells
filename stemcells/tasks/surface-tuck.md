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
  Where upstream's own layout would lay it over the chat, it tucks: a tab
  at the chat's right edge, standing on the Cell's shelf (the ledge's top),
  its page's mark showing and the rest folded behind it. The mark never
  moves: resting on it a beat, or focusing it, unfolds the tab toward the
  chat to the page's title and host. The whole tab is one button: a click
  or a tap opens it in the workbench: Look in a tab of several Cells, the
  panel beside the chat in a tab of one, the sheet in a narrow window. It
  is put away only on purpose: pushed into the edge, its menu (right-click
  or long-press: Open, Put away), or Delete. The floater ends; the browser
  stays among the workbench's tabs.
- Wide panes keep upstream's floater as it is.
- A tucked browser hosts no live view; its tab keeps the recording dot.
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

### PR 4: cards beside a wide chat

- [x] The floater beside the chat is a card: pointed at, it lifts; a click
      on its page opens it in the workbench (upstream's grip and buttons keep
      theirs)
- [x] Opened or put away, a surface flies between its card and the
      workbench, read once from upstream's floater store so every way in or
      out flies (`surfaces/flight.ts`)
- [x] Prove it: rest, lift, open, back, narrowed past the room (no motion),
      less motion (no flight), and the tucked card both ways

### PR 5: nothing moves under the pointer

- [x] The mark is the anchor: the tab unfolds toward the chat from behind
      it, and at rest only the mark's square takes the pointer
- [x] One gesture, one meaning: the whole tab opens it; no ×, and no first
      tap that only brings it out on touch
- [x] Put away on purpose: pushed into the edge past 24 px (the press's
      decision in `surfaces/tuck.ts`, its cases in `tuck.test.ts`), the menu,
      Delete
- [x] Unfold on intent: after 150 ms at rest on it (`--sc-timing-intent`), at
      once on keyboard focus; its face the page's title over its host
- [x] Prove it: before and after, a drag, the menu, the chip back, seven
      panes and a wide one

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

### PR 4

A wide chat's floater stays upstream's player, made a card: pointed at, it
and the desktop browser's page lift 4 px together; a click on the page
opens it in the workbench. The flight is a stand-in of the card's ground,
cut by a rounded clip that moves on the compositor; the live page waits
hidden where it lands and fades in over the spring's last pixels, not
after them (the last 300 ms of `lift` move under a pixel). Headless, one
pane at 1600 px: the card at rest beside the chat, lifted on hover; a
click flies it into the workbench in 0.7 s, the page fading in from
0.5 s; upstream's close flies it back into the card, the card fading in as
the stand-in fades out; narrowed to 900 px the card is tucked on the next
frame with no animation; with less motion, no flight. Seven panes: the
tucked card flies into Look's workbench and back into its peek. Not
proven: the desktop browser's page (Electron) under the flight.

Review fixes (an independent read of the change):

- A floater ended by its × or an agent no longer hides the workbench for a
  frame: a flight hides where it goes only once the panel shows the
  surface. With the panel on Files, × it: the workbench at opacity 1 every
  frame, no flight.
- A flight ended by a newer one of the same chat (opened, then closed at
  once) ends where it is and shows what it hid; nothing stays hidden.
- The desktop page lifts with the card whenever the card does, pointed at
  or focused within (upstream's buttons included).
- Not a defect: upstream's browser slot is not lifted with the card's
  layers; its direct parent there is our slot's `display: contents`
  wrapper, which has no box to move.

### PR 5

The card slid left to show its name, carrying the mark away from the
pointer and putting its × under it: a click meant to open the page hid it.
Now the tab unfolds from behind a mark that stays put, and nothing on it
hides. No upstream file changed (`drift`). Headless, the web dev server on
a lab home (a fake for every provider, Replay chats, a local page), a tab
of seven Cells:

- Before: pointed at, the mark moved 136 px left and × stood under the
  pointer; a click there ended the floater, no Look.
- After: pointed at for 60 ms, nothing unfolds; after the dwell the mark's
  box is where it was to the pixel, the ground grown toward the chat, the
  mark under the pointer. Pushed 14 px it springs back, no Look; pushed
  30 px, Put away or Delete, it goes and the pane's chip reads "Look at
  Example Domain again". The chip opens Look, Look's end tucks it again, a
  click opens Look; Enter and the menu's Open do too. Touch: one tap opens
  Look, a held press opens the menu and nothing else, a push puts it away.
  Less motion: it goes at once. One wide pane keeps upstream's card.
- The tab stays flush with the edge, so PR 1's 8 px gap that counted as the
  card is gone: the edge is the tab whether folded or not.
- Unfolded in a 220 px pane, the tab still covers the head of the Cell on
  the shelf, as PR 1's card did, until the pointer leaves.

Review fixes (the pull request's review):

- A press that opens the menu ends there (a ctrl-click on a Mac, a touch held
  still): the desktop's own menu may keep its release, which left the press
  open and the tab deaf to the next one. Headless, a primary press with its
  menu before its release: the menu, no Look; the next click, Look.
- A touch held for the menu shows it once: the browser's own long-press
  `contextmenu` from that touch shows none, a later right-click does.
  Headless: one menu built for the hold and its `contextmenu`, a second for
  the right-click.
