# Windows: tabs tear off, chats carry, Gather and Put back

A tab pulls off its strip into a window of its own. A chat carries from a
pane in one window into a tab or strip in another. One button gathers every
window into one and puts them back where they were. This file is the spec;
nothing is built until it's agreed.

## Plan

In this order: W1, W2, W3, W5, W6, W8 (Gather and Put back are what was
asked for by name), then W7, W4, W9, W11.

- [x] W1 The arrangement (web, pure): windows of tabs, every move and its
      inverse, Gather and Put back with their memory, display sets,
      invariants, the phone's flat order, persistence and migration.
- [x] W2 More than one window (desktop + web): our desktop layer, three
      seams, the boot handshake, the tab store reading its window's slice,
      Move Tab to New Window (⌥⌘T, no motion yet), closing a window, Aski
      going home, relaunch. Measured: memory, boot and server load per
      window.
- [x] W3 Shared state across windows: drafts, right panel and terminal UI
      merge on `storage`; notifications from one window (the focused one,
      else the lead); a chat open in another window raises that window.
- [ ] W5 Tear off: the carry engine, the flight layer, the tear band, the
      chip unfolding into a window preview, the drop in open space,
      Esc, the one-tab window, mid-flight reversal, Reduce Motion. In
      steps:
  - [x] W5a The carry engine (web, pure), fed recorded hands in tests.
  - [x] W5b The flight layer (desktop): one window per display, stills
        from `capturePage`, keyframes from the renderer; frames proved in
        the lab.
  - [x] W5c The strip carries: pick up, band, tear, the preview, the
        drop in open space, Esc.
  - [x] W5d The one-tab window carries itself (docking it into another
        window's strip comes with W6).
  - [x] W5e The warm window: a dropped tab's window drawn before the
        drop, so its still goes at once.
- [ ] W6 Into another window's strip: geometry, making room, spring-load
      raise, landing; Undo Move (⌥⌘Z). In steps:
  - [x] W6a A tab carried into another window's strip: the strips measured
        at the pick-up, the host making room, spring-load, the landing.
  - [x] W6b A one-tab window into another window's strip: its still folds
        into a chip, and the window closes once the host has the tab.
  - [x] W6c Undo Move (⌥⌘Z) for the moves between windows.
  - [x] W6d Closing a window as a move Undo Move takes back.
  - [ ] W6e Undo Move playing the move's own motion reversed.
- [x] W8 Gather / Put back: the button, ⌥⌘G, memory per display set,
      the flights, full screen restored.
  - [x] W8a The button and ⌥⌘G, read from the windows as they are, each
        press a move Undo Move takes back.
  - [x] W8b Gather's flight: each other window's still shrinks into its
        place in the home strip.
  - [x] W8c Put back's flight: chips lift and unfold into stills, and
        each window lands under its still.
- [ ] W7 Carry a chat: the Cell as the handle, pane halves, tabs, strips,
      windows and open space.
  - [x] W7a In its own window, onto a half of another pane in the tab on
        stage: the card, the wash, the landing, Esc.
  - [x] W7b The strip in its own window: a chip spring-loads its tab, the
        strip makes room for a new tab.
  - [x] W7c Thrown: let go with speed in its own tab, the chat stays and
        its Cell flies (the original's toss), bonks, and walks home
        (`tasks/cell-toss.md`, The flight).
  - [ ] W7d Other windows: the card on the flight layer, their panes and
        strips answering, spring-load raising them. Their chips take a
        chat (`tasks/chip-drop.md`); their panes, the room for a new tab and
        the raise are still to come.
  - [ ] W7e Open space: the card unfolds into a one-pane window.
- [ ] W4 The browser in any window: one seam in the preview manager; a
      moved browser pane shows its last frame until its new guest paints.
- [ ] W9 Displays: unplugging gathers that display's windows, plugging it
      back puts them back; frames clamped on relaunch.
- [ ] W11 Settings as a tab (spike first, below).
- Later: the phone's flat tab order, when the phone gets tabs. W10,
  several chips carried together as a stack, only if asked for: a tab of
  several Cells already tears off as one unit, and that is the tab group.

## Why someone detaches a tab

Tabs share one stage: a swipe shows one at a time. A window is how two
things are seen at once, at a size and place the person chose.

- **A project per window.** Work spans two to four live chats across
  projects. A window per project keeps each window's swipe deck inside one
  project, so a swipe never lands in another project's Cells. The window
  _is_ the tab group.
- **Watch a long run** on a second display while working in another window,
  without it sitting in the swipe deck.
- **A Cell beside something else**: the simulator, an editor, the browser
  it's testing. The OS tiles windows; the app only has to make the window.
- **Aski or Settings on their own display**, out of the deck.
- **One Cell full screen** for focus, or shared on a call alone.

And why gather: the laptop alone, a meeting, a change of task. One window
with every tab is swipeable; four overlapping windows on 14 inches aren't.
Put back is what makes gathering free to try.

## What the Mac app did, and what we keep

The Mac app built this (one pure arrangement, side shelves, a flight
overlay, two drag thresholds, gather and put back). Its suites were deleted
and it was never checked by hand, so it's a source of ideas, not a
reference build.

| Its piece                                                              | Here                   | Why                                                                                                   |
| ---------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| A pure arrangement, every move a value → value function                | **Keep**               | The only way to test moves, inverses and gather round trips without windows                           |
| Two thresholds: pick up, then a rubber-banded tear                     | **Keep** (4 px, 24 px) | Reorder stays reorder; tearing is felt, not accidental                                                |
| What you hold shows what you'll get: a full-size preview past the tear | **Keep**, sharper      | The preview is the tab's page 1:1 at the source window's size (below), not a fixed fraction           |
| A one-tab window drags as the window                                   | **Keep**, live         | It moves itself, live, until it nears a strip; only then does a picture take over to fold into a chip |
| Hand-off waits for the receiver's paint                                | **Keep**               | No frame without the thing on screen                                                                  |
| Esc cancels a carry                                                    | **Keep**               |                                                                                                       |
| Spring-loaded strips                                                   | **Keep**, narrower     | Raise a window only when its strip is hovered for 350 ms and it isn't already in front                |
| Gather / Put back, remembered per display set                          | **Keep**               | It's the feature                                                                                      |
| Unplugging a display parks its windows; replugging restores            | **Keep**, narrower     | Gather only that display's windows; put them back on replug automatically                             |
| Side shelves (tabs parked at a screen edge)                            | **Drop**               | Half its complexity. Our tabs already hold panes side by side, and the OS tiles windows               |
| Edge dock bands                                                        | **Drop**               | The OS has window tiling                                                                              |
| Grouping memory per tab                                                | **Drop**               | A tab's home is the window it's in                                                                    |
| One parked-arrangement slot                                            | **Replace**            | A memory per display set                                                                              |
| Hand moves clear the gather memory                                     | **Replace**            | The button's state is derived from what's on screen (below)                                           |
| ⌘Z for six seconds                                                     | **Replace**            | An undo stack: Undo Move, ⌥⌘Z, any time, while what it moves still exists                             |
| No reversal mid-flight                                                 | **Improve**            | Latest input wins, as the swipe does                                                                  |
| Full screen remembered, never restored                                 | **Improve**            | Put back restores it                                                                                  |
| A landing cross-fade from a picture                                    | **Improve**            | The live window lands under the picture, then the picture fades                                       |

## The model

### Processes

One renderer per window, each running upstream's app unchanged: its own
router, client runtime, WebSocket and stores. The alternative, one renderer
drawing into child windows through portals, breaks upstream everywhere it
assumes one `document` and one `window`: popovers portal to the global
`document`, ChatView listens on `window`, the browser view mounts at the
app's root. The cost is memory and a WebSocket per window; W2 measures it.

### The arrangement

```ts
interface Placed {
  readonly id: WindowId;
  readonly frame: Rect; // screen points, the window's outer frame
  readonly display: DisplayKey; // the display holding the frame's centre
  readonly fullScreen: boolean;
  readonly workspace: Workspace; // today's tabs → rows → columns → panes
}
interface Arrangement {
  readonly windows: ReadonlyArray<Placed>; // front to back, by our focus order
  readonly lead: WindowId; // upstream's main window
}
interface Memory {
  readonly displays: DisplaySetKey; // sorted id:size@scale of every display
  readonly arrangement: Arrangement; // where each tab id was, frames, full screen
  readonly home: WindowId; // the window everything gathered into
  readonly automatic: boolean; // parked by an unplug, restored by a replug
}
```

`Workspace`, `Tab` and `Pane` are `tabs/layout.ts`'s, unchanged. Ids are
global: a pane keeps its id across windows, because upstream files drafts
under it.

**Who holds what.** The main process stores the arrangement: it persists
it, knows each window's frame and display, and keeps the gather memories
and the undo stack. Each renderer is the one writer of its own window's
workspace: a split, a focus, a reorder or a swipe runs through today's
reducers in that renderer, at no IPC cost, and the result is published to
main. Only moves _between_ windows go through main, as transactions.

This refines "one arrangement in main as the single truth": main is the
truth at rest, and nothing races it, but in-window edits stay local. Moving
every edit through main would put an IPC round trip under each keystroke
that focuses a pane, and the move functions would have to live in the
desktop app, which can't import the web app's reducers without a new
package (and its lockfile churn).

**Moves.** Pure functions in `apps/web/src/stemcells/windows/`
(`moves.ts`, `gather.ts`): `tear`, `join`, `carry` (to a pane's side, a
strip or open space), `closeWindow`, `gather`, `putBack`,
`displaysChanged`.

Each returns the next arrangement, the **transaction** that takes the
windows there (windows to open, each changed window's whole workspace and
place, windows to close, the one to bring forward, the lead, the
memories), and an undo entry (the arrangement before and after).

- **Values, not edits.** The renderer that starts a move computes it from
  main's snapshot. Main refuses it if any window it touches has published
  since that snapshot, and the renderer recomputes from a fresh one and
  sends it again, unseen. Accepted, main sends each window its new
  workspace, which the window adopts, and opens and closes windows. Main
  needs no layout logic of its own, and a window applies one value. The
  window between a publish and a refusal is an IPC hop; only a background
  update (a draft becoming its thread) can land there, and the next route
  event puts it right.
- **Undo** (`undo` in `moves.ts`) takes a move back while every window it
  touched still has the shape the move left (tabs, panes and which chat
  each shows; focus and the active tab don't count). It restores those
  windows' shapes with each pane's current chat, so a draft sent since
  stays sent. A window moved by hand since stays where it is. The lead
  stays with the window it passed to.
- **No-op carries:** a chat carried to where it already was only moves
  focus, and has nothing to undo.

**Invariants**, checked after every move in tests:

- Aski's tab exists once, first in whichever window holds it. Closing that
  window sends it home to the lead window.
- A chat lives in one pane in one window. Opening a chat that is open in
  another window raises that window and focuses its pane.
- Every window has a tab, except while a one-tab window is mid-carry.

**The lead window** is upstream's main window. Aski's keeper and, later,
the phone's publishing run there only; notifications run there while no
window of the app has focus. When it closes,
our layer promotes the frontmost window with upstream's `setMain`, so the
menu, reload and dev tools keep a target. A window leads, or counts as in
front, only once its page has loaded: one still opening (or one that never
will) can't take Aski home. With none loaded, the next page to load leads.
A move that makes a window still opening the lead has it lead once its page
loads.

**Persistence.** Main writes `stemcells-windows.json` in the desktop state
folder (`windows/persist.ts`'s format: the windows, the lead, the memories
and the displays last seen), debounced, and flushes it on quit. Windows
closing while the app quits (the app's own flag, which an update raises
before it closes them) stay in the file. An update that can't install
lowers the flag and the app carries on: the windows kept meanwhile open
again as soon as it does (the host looks while the flag is up), or, with
none left open, when upstream's main window comes back.
A file that can't be read (not readable, not JSON, a book this app doesn't
know) is moved aside as `.corrupt-<time>`; one that can't be moved aside
isn't saved over.
The undo stack isn't kept. At launch main opens every stored window at its
frame at once, and the lead window runs `displaysChanged` against the displays last
seen, so a display gone since gathers its windows. The first desktop boot
with no file adopts the old `stemcells.tabs` from the renderer's
localStorage as window 1. Upstream keeps saving window 1's bounds as it
does; ours agree with it. The browser build stays one window on
localStorage, running the same functions over a one-window arrangement.

**Boot.** A window learns who it is synchronously: our preload asks main
once (`sendSync`) and gets its id, its workspace and whether it leads,
before the app's scripts run, so the tab store's first read stays
synchronous. Main knows the asker by its `webContents`; no id rides the URL.
A window a move opens is bound to its id as upstream's maker returns it,
which is in the same turn as the maker starts its page loading, so its page
can't ask first; were it to, it would take the oldest window still opening,
a guess that two windows opening at once (a move's and a tear's warm one)
could get crossed. Left as is: making it certain needs the id handed to
upstream's maker, a new seam.

## Interactions and their motion

Every timing and spring is a token in `tokens/stemcells.css`, read through
`tokens/motion.ts`. No new motion tokens. Geometry constants live in code
beside the functions that use them, as `LATCH_DISTANCE` does.

| Constant        | Value                                                                                                                                   | Where it's from                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Pick up         | 4 px                                                                                                                                    | today's `DRAG_START_DISTANCE` in the strip                                     |
| Swap hysteresis | 8 px                                                                                                                                    | today's `SWAP_HYSTERESIS`                                                      |
| Tear band       | 24 px past the strip's top or bottom edge                                                                                               | The lead's 24–40 px; 24 reads as deliberate on a trackpad without a long reach |
| Band resistance | shown = 18 · (1 − 1 / (1 + 0.55 · d / 18)), d the hand's distance                                                                       | 7.6 px shown at the tear: felt, then let go                                    |
| Catch zone      | a strip's rect, grown by the tear band downward                                                                                         | Where a carried chip docks                                                     |
| Preview size    | the tab's last window size; else the source window's when it's under 85 % of its display each way; else 75 % of the display's work area | The page is shown 1:1, never resampled, unless the source fills the screen     |
| Cascade         | 24 px down and right of the source                                                                                                      | Move Tab to New Window                                                         |

### Tear a tab off

1. **Pick up.** Press a chip and move 4 px: it lifts, `scale(1.04)` on
   `nudge`, as reordering does today.
2. **Pull.** Below or above the strip the chip follows the band's
   resistance; along the strip it reorders as today.
3. **Tear, at 24 px.** The chip hands off to the flight layer: the layer
   paints a still of the chip at its exact screen rect, and only then does
   the strip hide it. The chip catches up to the hand on `nudge`. The
   strip closes the gap on `travel`. If the tab was on stage, the source
   window's pager turns to the neighbour (the right one, else the left) on
   `page`: the source shows what it will be after the drop.
4. **Unfold.** Out of every catch zone, the chip unfolds into a window
   preview: its frame grows from the chip's rect to the preview frame on
   `unfold`, hung from the hand so the preview's only chip stays under the
   finger at the same grab point. The chip's still cross-fades to a still
   of the tab's page on `flick`; the window's shadow comes in on `fade`.
   A tab that wasn't on stage has no picture yet: the preview shows its
   frame with the chip and the outline of its panes, each with its Cell
   and name, until the warm window (step 6) has painted, then cross-fades
   to that on `flick`.
5. **Carry.** The preview tracks the hand 1:1, no spring, across displays,
   its top kept below the menu bar.
6. **The warm window.** At the tear, main starts the window the drop would
   make: hidden, holding the tab, drawing while hidden. It boots into the
   windows as the move would leave them, so none of its chats is anywhere
   else, and it stays out of the book and the others' news until the drop:
   it isn't the lead (no notifications), takes no focus, and no one can
   type in it. If the carry ends anywhere else, it is destroyed with the
   flight, without its unload writes. No blank spare is kept booted for
   quick drops: it would hold a renderer (0.3 to 0.5 GB) at all times,
   while a quick drop already shows the window in place as its still
   (W5e's review note has the times).
7. **Drop in open space.** The transaction commits; the warm window takes
   the preview's frame exactly and shows, under the still. When it has
   painted, the still fades on `flick`. The window takes focus. If it
   hasn't painted yet, the still stays until it has.
8. **Cancel (Esc), or a drop no window takes.** The preview folds back to
   the chip on `settle` while flying home on `land`; the source gap
   reopens on `travel`; the pager turns back on `page`.

From a full-screen window the drop lands in a new window on the desktop
Space, as macOS places any new window of a full-screen app (checked in W5).

### Into another window's strip

1. Entering a catch zone, the preview folds into the chip on `settle`.
2. The host's chips at and after the slot slide over by the chip's width
   and gap on `travel`. The slot is the count of chips whose middle is left
   of the hand, with today's 8 px hysteresis.
3. A strip catches only where its window is the front one of ours under
   the hand: a strip hidden under another of our windows can't be seen, so
   it takes nothing. Held over a strip for `spring-load` (350 ms) whose
   window isn't our front window, that window comes forward without taking
   focus. We can see only our own windows' order; a strip under another
   app's window still takes the drop, and the window comes forward as it
   lands, so the landing is never hidden. A chip docks 8 px inside a catch
   zone and leaves 8 px past it, so at the edge it doesn't fold and unfold
   with each pixel.
4. **Drop.** The chip lands in its slot on `land`. The host has already
   painted the real chip, hidden, in that slot; it shows in the frame the
   layer's still goes. The host turns to the tab on `page` and takes focus.
5. **Leave the zone** and the chip unfolds back into the preview (`unfold`);
   the host closes its gap on `travel`.

### A one-tab window

Pressing its only chip and moving 4 px moves the window itself, live, 1:1:
the chat keeps streaming in the hand. Nearing a strip's catch zone, the
layer paints a still of the whole window over it, the window goes to
opacity 0 under the still, and the still folds into a chip on `settle`.
Leaving the zone reverses it: unfold, the window back to opacity 1 under
the still, the still gone. Dropped in a strip, the window closes after the
host has painted the tab. Esc flies it home on `land` as a still: the
window, hidden, already waits there, and shows under the still before it
goes; with Reduce Motion the window is home at once and the still fades
where it was. A window hidden under a flight shows again whenever the
flight ends.

macOS tiling (dragging a window to a screen edge) works only for the
system's own title-bar drags, which this isn't; the strip's empty space
still drags the window natively.

### Carry a chat

The handles are the Cell, its mark at the start of the line over the
composer, and a grip at the middle of the pane's top. A pane has no
header, the Cell is the chat's identity, and picking up the Cell to carry
the chat reads as what it is; the grip is where a hand looks for a pane's
own handle.

1. **Pick up** (4 px). Taken by its Cell, the Cell itself hangs from the
   hand, and the pane recedes (its contents dim) once the hand is over a
   place the chat would go. Taken by the grip, a card, the Cell's mark and
   name, appears under the hand on `flick`, and the pane recedes at once.
   Nothing grows or shrinks out of the pane, and a cancel has nothing to
   undo but the dimming. (Until 2026-10-23 the pane gathered into a card
   on `lift`, its place left empty: it read as a minimize.)
2. **In its own window**, today's drop machinery answers: a pane's half
   lights with the wash (`DropWash`, gliding on `travel`); a chip lights and
   opens after `spring-load`; the strip makes room for a new tab (`travel`).
3. **Out of the window**, the card hands off to the flight layer as a
   still. Over another window, main relays the hand to that window, whose
   wash and strip answer exactly as at home; its window comes forward after
   `spring-load`.
4. **Open space**: the card unfolds into a window preview holding one pane
   (`unfold`), then lands like a torn tab.
5. **Drop**: on a half, the card fades from the hand as the chat takes its
   place, or the Cell goes home to its line there on `land`; into a chip,
   slot or window the card lands on `land`, the Cell going in after it.
   The panes on stage glide to their new places on `land`
   (`tabs/glide.ts`). A tab whose last pane left closes (`leave`); a
   window whose last tab left closes.
6. **Cancel**: the card fades from the hand, or the Cell goes home, and
   the pane comes back.

Before the source lets go of a pane, its pending draft write is flushed,
and the carry is marked so upstream's drop-left-draft cleanup doesn't
delete a draft that is only moving.

As built (W7a): the handle is the Cell over the composer, so a chat is
carried once it has been sent (an unsent one has no line yet). The card
is the Cell and its name, in the shape of a dragged tab. A carry is a move
like the rest (`carry`): through the desktop app, so Undo Move takes it
back, and in a browser straight into the tabs. Both keep the draft: the
desktop app's moves come back as adoptions, which the drop-left-draft
cleanup leaves alone, and a chat carried within a window never leaves the
workspace; `commitMove` flushes the pending draft write first. The empty
place keeps the grid's hairlines.

As built (W7b): over the strip, another tab's chip under the hand lights
and opens its tab after `spring-load`, and past the last chip the strip
makes room for a new tab, growing by a chip so the + and what follows move
over (a tab carried in from another window gets the same room). Between
chips is nothing: the room only opens at the end, so the chip under the
hand never slides away from it, and a new tab can be dragged into order
afterwards. Aski's chip takes no chat. Let go in the room, the chat becomes
a tab there and the card lands on its chip. Let go on another tab's chip,
the chat goes to that tab's end and the card lands on the chip, while the
person stays where they were (`tasks/chip-drop.md`). Let go anywhere else
after a tab sprang open, the tab the chat came from comes back on stage
before the card flies home.

As built (W7c): let go faster than 100 px/s in the chat's own tab, the
chat stays and only its Cell flies, in a layer over the window's content:
the original's thrown soft Cell with its numbers, bouncing off the
content's sides, top and floor, then walking home in at most 3 s. It can
be caught mid-air; Esc sends it home; under Reduce Motion nothing is
thrown. Its spec and numbers: `tasks/cell-toss.md`, The flight.

### Move Tab to New Window (⌥⌘T)

From the keyboard or a chip's context menu. The chip lifts (`lift`), and
unfolds into a window cascaded 24 px from its source (`unfold`); the live
window lands under it as above. No "Move to window…" submenu: dragging is
how a tab goes to a window that exists.

### Gather and Put back

One button at the strip's trailing end, ⌥⌘G, and Window › Gather Windows /
Put Windows Back. It shows only when it can act, and what it does is read
from the screen, not from history:

- more than one window on this display set → **Gather windows**;
- one window and a memory for this display set → **Put windows back**;
- otherwise it isn't there.

The icon cross-fades between the two on `flick`.

**Gather** pulls every tab into the window it was pressed in, in screen
order: that window's tabs first, then each other window's, left to right,
top to bottom, each keeping its order and Aski's tab first. The memory
(frames, full screen, each window's tab ids and active tab) is kept for
this display set. Motion: the layer stills each other window, the window
goes to opacity 0 under it, and the still shrinks into the place its tabs
will take in the home strip on `travel`, fading in its last stretch
(`fade`) as the home strip makes room for its chips (`travel`). Windows
leave one `beat` (120 ms) apart, nearest first; each closes once its chips
have landed.

**Put back** reopens each remembered window at its frame with its tab ids,
in reverse: chips lift from the home strip (`lift`), unfold into stills of
their windows as they were when gathered (`unfold`), staggered by `beat`,
and each live window lands under its still. Full-screen windows go full
screen after they land. The home window returns to its own remembered
frame.

What changed between the two: a tab closed since is skipped; a tab opened
since stays in the home window; a tab's panes come back as they are now
(the memory holds tab ids, not their insides). Gathering again replaces the
memory.

As built (W8a): main tells every window when a window opens or closes or
a display is plugged in, out or changed, and each window's button reads
the windows and the display set from a fresh snapshot. Pressed, the
button or ⌥⌘G makes the move it offers from another fresh snapshot, so
a stale button does nothing. Gather and Put back are moves like the rest:
Undo Move takes either back, the memory with it. The Window menu items
aren't built: the button and ⌥⌘G cover them, and they would need the
menu's seam.

As built (W8b): each other window closes as soon as its still covers it,
not once its chips land; under the still, nobody can tell. The still keeps
the window's proportions as it shrinks, cropped by the frame that becomes
the chips' outline, so it never squashes. A window holding Aski's tab and
Cells lands on its Cells' chips (Aski's chip never moves). A full-screen
window has no frame to fly from on this Space, so it closes without a
flight and its chips show at once. The gathered tabs join the end of the
strip, so the home's own chips only move when the strip runs out of room,
and then they jump.

As built (W8c): no stills are kept from the gather (the memory is
written to disk and holds ids and frames), so Put back unfolds each
window's chips into a frame of the window's chrome with the chips at the
window's first chip, farthest window first, one `beat` apart: the chips
on `lift`, the frame on `unfold`. The move is made once the last frame
has unfolded, so every window opens under its frame wherever it shows,
and each frame fades on `fade` once its window has drawn. In the dev
build that wait is 1.8 s after the frames are in place. If a release
build's wait shows in the hand check, the windows can start hidden at the
press (as the warm window does) and show on their frames. A full-screen
window opens and goes full screen without a flight. The home window goes
back to its own frame at once. Under Reduce Motion the windows just open.

### Undo Move (⌥⌘Z)

Every move above, and closing a window, pushes its inverse. Undo Move
plays it with the move's own motion reversed, as long as every tab and pane
it names still exists where expected and no chat it brings back is open in
another window; otherwise that entry is dropped with a quiet note, and the
press does nothing else: the moves are a stack, and a press never reaches
past the latest to an older one. ⌘Z stays the composer's. A carry in the
hand holds ⌥⌘Z (and ⌥⌘G) off until it is put down.

As built (W6c): each move a page commits carries its undo entry (the
arrangement before and after, written as the windows file writes them),
and main keeps the latest 20, not between launches. ⌥⌘Z in any window
takes the latest back with `undo` from a fresh snapshot; one whose windows
have changed shape since, or that would bring back a chat opened elsewhere
since (a window closed, then one of its chats opened in another), is
forgotten with a note, "Can't undo that move", that says which, and the
next press tries the one before it. Every undo's result is checked whole
in the tests: no tab, pane or chat in two places. The windows change at
once, without motion yet (W6e).

Closing a window (W6d): the red button or Close Window reaches main as
the window's `close`, which main holds and hands to the window's page; the
page closes it as a move (`closeWindow`), Aski's tab going home to the lead
in the same transaction, so Undo Move reopens the window with its tabs. A
page that doesn't within a second, the last window, and quitting close as
before. A page's own `window.close()` bypasses `close` (checked in a
scratch window); nothing of ours calls it.

### Displays

Unplugging a display: its windows gather into the frontmost window on the
displays left, with an automatic memory under the old display set.
Plugging that set back in puts them back on its own, with Put back's
motion: the windows fly back to the monitor. A relaunch clamps every frame
to the displays there are, gathering windows whose display is gone the
same way.

### Every window

Each window keeps the two-finger swipe, its own phantom new-Cell page past
the last tab (never a drop target), ⌘T, its own sidebar and route.

### Reduce Motion

What follows the hand still follows it 1:1. Every morph (chip ↔ preview,
card ↔ chip) becomes a cross-fade (`fade`); every flight becomes a fade
out where it was and a fade in where it lands; strips making room jump
(`cut`). Gather and Put back fade each window out and in, one `beat`
apart.

## The flight layer

A transparent, click-through, unfocusable, always-on-top window per
display, made the way the snapshot overlay already makes one
(`snapShot/SnapShotTransition.ts`), visible over full-screen Spaces.
Made at the pick-up and gone when the flight ends: kept between flights,
a hidden layer would be the "first window" upstream reveals on a Dock
click when no app window is open. It loads in about 100 ms, well before a
hand travels the 24 px to the tear.

- **What it draws:** stills, a window frame (the slate's radius, a shadow
  close to the system's), and nothing else. Stills come from the main
  process: `webContents.capturePage(rect)` of the window showing the thing,
  never a capture from inside the renderer (it crashed look mode).
- **How it moves:** the source renderer resolves every animation from the
  tokens (`spring.ts`'s `cssLinear`) and sends keyframes; the layer plays
  them, and sets positions directly while they track the hand. It holds no
  motion logic of its own. Main coalesces commands to one per frame.
  Reversal: a new animation starts from the layer's current computed
  transform.
- **Hand-offs** between a live surface and a still wait for the receiver's
  paint; the giver hides in the frame after. At worst a frame shows both,
  never neither.
- **Lag budget:** a carried chip is at most two frames behind the hand at
  120 Hz. If the layer's command path misses it, it gets a preload and a
  message port from the source renderer instead.

## The carry engine

One engine, in `apps/web/src/stemcells/windows/carry.ts`, pure: hand
samples in (screen point, time, phase), carry state out (phase, the target
window and slot or half, the preview frame, what the layer shows). It runs
in the renderer where the press began; that renderer keeps the pointer
captured, which on macOS keeps the drag's events coming outside its
window. If W5's first spike finds otherwise, main samples
`screen.getCursorScreenPoint` at display rate during a carry and feeds the
same engine.

At pick-up it asks main once for a geometry snapshot: every window's frame
and focus order, and each window's strip, chips and panes in screen points,
which each renderer reports on request. Hit-testing is local to the
engine. Main relays "a carry is over you at slot s" to a target window so
its strip makes room; the target draws, the source decides.

The swipe's lessons carry over: latest input wins, nothing waits on a
timer the hand can beat, and in tests the engine is fed recorded hands.

## Edges

- **The browser in a pane.** A `<webview>` guest can't move between
  windows; in a new window it's a new guest (cookies persist in its
  partition). The pane shows the page's last still until the guest's first
  paint. The preview manager accepts webviews only from the main window
  today: one seam (W4). Whether `capturePage` includes the guest is checked
  in W5; if not, the browser pane's still is its last frame from the
  preview manager.
- **Aski's tab** tears off like any tab; it's first in whichever window
  holds it; closing that window sends it home. Every other window's strip
  keeps Aski's place, which brings Aski's window forward on Aski's chat.
- **The new Cell past the last tab** has one draft for the whole app, kept
  in step across windows like every draft, so each window's page past the
  last tab shows the same words. Taken (written in) in two windows at once,
  it would be one chat in two places. Open, for W5 with the tab swipe's
  owner: a taken new Cell is published like a tab, so a second window
  shows it as open elsewhere.
- **Settings** is upstream's route, not a tab. Each window can show it
  (⌘,) today. W11 makes it a tab so it tears off like one; it starts with
  a spike: upstream's settings pages rendered inside a tab page under a
  memory history. If they need the window's own router, Settings gets a
  window of its own instead, opened from the same key.
- **The phone** mirrors tabs, not windows: one flat order, the lead
  window's tabs first, then each other window's by screen position. The
  phone has no tabs endpoint yet; this waits for it.
- **Notifications** mount once per renderer upstream: N windows, N
  notices. A substitute renders upstream's coordinator in one window: the
  focused one, which judges by its own focus and route (a toast unless it
  shows the chat, never a system notification while it has focus), else
  the lead while the app is in the background (`book.ts` `notifier`).
- **Shared localStorage.** Upstream's drafts, right panel state and
  terminal UI state are each one key, written whole by every window, so
  windows overwrite each other. Our adapter listens for `storage` and
  merges entry by entry (one chat's draft, one chat's panel). Every entry
  carries a version, a Lamport counter and the window that wrote it,
  written in the same write as the value (the drafts' in their state, the
  others' beside it). A window gives an entry it changed a new version and
  takes another window's value only where that one's version is newer. A
  window passing on what it took passes its version on too, so a
  bystander's write never wins over typing it hadn't heard, and a write
  with nothing newer changes nothing, so windows settle. A base of "the
  last write heard" wasn't enough: with three windows, one passing on a
  stale entry undid another's typing. A deletion keeps its version (the
  latest 256 are kept), so a sent draft stays sent.
  Sharing starts as the app's first modules load (`main.tsx`), in the turn
  the stores read localStorage, and takes what's on disk then as another
  window's write: a window holds no versions of its own until it hears
  one, so one that loaded slowly takes what was written meanwhile rather
  than pinning what it read under a newer version. Its writes carry
  versions from before that take, so the take is written with them.
- **Many windows.** Each is a renderer, a client runtime and a WebSocket.
  W2 measures memory per window, boot to first paint, and the server's CPU
  with four idle windows against one. No cap unless the numbers ask for
  one.
- **Our windows only.** Electron can't read other apps' window order, so a
  strip under another app's window still takes a drop (its window comes
  forward as the chip lands).
- **A browser pane under a carry** takes the pointer as soon as the hand
  crosses it, even under pointer capture, unless `pointer-events: none`
  applies before the press. Every carry sets it on the window's browser
  panes at the press, before the first move.
- **⌘W** on the last pane of the last tab closes the window, as upstream
  does with its one window.

## Seams and drift

When this was written: 69 upstream files changed, 670 lines, 8 hot
(`drift`, 2026-10-21).

| File                                                | Change                                                                                                                                                                                                | Heat (90 d) | Slice        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------ |
| `apps/desktop/src/main.ts`                          | Imports our windows layer and adds it to `layerDesktopApplication` (already a seam: scroll phases)                                                                                                    | 28          | W2           |
| `apps/desktop/src/preload.ts`                       | Imports `stemcells/windowsPreload.ts`, which exposes `window.stemcellsWindows` (already a seam: scroll phases)                                                                                        | 40          | W2           |
| `apps/desktop/src/window/DesktopWindow.ts`          | `createWindow` takes an optional `{ bounds, show }`; such a window skips the main window's bounds saving, preview registration, maximizing and dev tools; the service gains an optional `createExtra` | 31          | W2           |
| `apps/desktop/src/preview/Manager.ts`               | Accepts webviews hosted by any of the app's windows                                                                                                                                                   | 57          | W4           |
| `apps/desktop/src/window/DesktopApplicationMenu.ts` | Window menu: Move Tab to New Window, Gather Windows / Put Windows Back, Undo Move                                                                                                                     | 11          | W8, optional |

W2 as built: one new upstream file (`DesktopWindow.ts`, 25 lines), and
three lines in two files that were seams already. All five, at most:
three new files, about 50 lines, still 8 hot; every seam is cold.
Our IPC channels are our own strings in our files, so `packages/contracts`
isn't touched. `createExtra` is optional, so upstream's test doubles of
the window service need no change. The web side needs no seam:
notifications go through a substitute, the strip and keys are ours, the
stores merge in our adapter. `createWindow` is reused, not copied,
because it installs upstream's webview hardening, popup handling,
navigation guard and renderer recovery, and a copy would drift silently.

**Upstream candidates:** "more than one app window" (the `createWindow`
seam) and "browser previews in any window" (the preview manager's) are
both things upstream might want, and either would retire a seam. Posting
to upstream's repository is public, so neither is offered without the
owner's go-ahead.

## Tests

**Pure (W1, vitest, `apps/web/src/stemcells/windows/*.test.ts`):**

- Every move applied then inverted returns the same arrangement, over
  seeded random arrangements (windows, tabs, panes, Aski's tab).
- Gather then Put back is identity; with a tab closed between, it's
  skipped; with a tab opened between, it stays home; Aski's tab first.
- The invariants hold after every move: Aski once, a chat once, no empty
  window.
- The button's state from windows and memories; display set keys; an
  unplug parks, a replug restores, a relaunch clamps.
- A transaction applied to the arrangement it was made from gives the
  move's result; main refuses one made from a window's older state (W2).
- The phone's flat order; serialization round trip; migration from
  `stemcells.tabs`.

**The carry engine (W5–W7):** recorded hands in, states out: the band
curve, the tear at 24 px, catch zones, slots with hysteresis, the preview
frame hung from the grab point and kept under the menu bar, spring-load
timing, Esc, reversal mid-flight, Reduce Motion's plan. Flight plans for
Gather and Put back: order, delays, targets.

**Desktop (W2+, vitest with Effect test layers, as upstream's desktop
tests):** the registry, persistence and its flush, the boot handshake,
validation, lead promotion on close, display events from a fake screen.

**Browser (vitest browser, as `TabPager.browser.test.tsx`):** the strip
lifting, banding, closing its gap and making room.

**Frames in the dev app, off the person's screen.** The dev app runs
under the house lab helper (`stemcells/lab/never-shown.cjs`): every window
and flight layer is hidden, off every display, painting while hidden and
never focused. A driver sends input to the source page over the remote
debugging port (the cursor never moves) and reads frames back with
`capturePage`, with motion slowed. As the helper keeps every window off
the displays, where a window opens is read from the frame it was asked
for; its size is its own.

What the frames must show: no frame without the carried thing; the
preview's chip under the grab point; the drop landing on the preview's
frame to the pixel; the host making room and the chip landing in its
slot; the warm window under the still before the fade; Gather's stagger.

**By hand, once merged and installed:** tear off and drop on another
display; drop into another window's strip; carry a chat by its Cell to a
pane half, in its own window and in another; Esc mid-carry; Gather, Put
back, Gather, with one window full screen; unplug and replug a display;
relaunch with three windows; a browser pane moved; Reduce Motion on; a
carry with View › Zoom at 125 %; a one-tab window carried by its chip
while its chat streams; the red button on one of two windows, then ⌥⌘Z; a
chip rested on the strip of a window behind another coming forward; a
quick tear and drop (under a second), watching for a wait before the new
window answers.

## Review

- W1: the moves, Gather, Put back and the display changes are pure
  functions over plain values, proved by hand-built cases and by seeded
  random arrangements and walks of 25 moves (every step whole, every step
  undoable). A transaction is whole values per window, not edits, so the
  desktop app needs no layout logic to route it.
- W2: proved in the lab (a development build whose windows never show):
  ⌥⌘T opens a window 24 pt down and right holding the tab and both of its
  Cells, and the window it left keeps the rest. A quit and relaunch
  reopens every window with its tabs, and the same lead. Closing a window
  drops it from the book and tells the others; closing the window that
  holds Aski's tab seats Aski first in the lead; closing the lead passes
  the lead to the window left, which seats Aski. Measured in that build
  (heavier than a release): each window adds a renderer of 0.3 to 0.5 GB
  resident (110 MB of it JavaScript heap), about 35 MB in the main
  process, 4 MB and two connections in the server, and no idle server
  CPU; a new window draws its tab 1 to 1.5 s after ⌥⌘T. That is over
  `dwell`, so W5's spare window is likely needed; W5 measures a release
  build first.
- W3: proved in the lab: drafts typed in two windows in turn are all in
  each window and in storage; without the merge, each window's next write
  dropped the other's. The merge reads, writes and hydrates through each
  store's own persist options, which a contract test pins with upstream's
  stores. Versioned entries are proved with upstream's real stores, one
  copy per window over one storage: the three-window crossing that lost a
  draft under the last-heard merge, and seeded random runs of four windows
  (typing, sending, panels, terminal heights, each heard late and in
  order), where every window ends with each chat's last change and
  nothing more is written. The old merge lost a sent draft in the drafts'
  runs and echoed without end in the others'. Notifications come from one window's coordinator, the focused
  one's or else the lead's (a build substitute, pinned by the substitutes'
  contract test; the lab has no live chats to notify of). A window without Aski's tab drew Aski's place
  as not ready; it now brings Aski's window forward (lab: the lead went to
  Aski's chat, the other window stayed on its tab).
- W5a: the carry engine is pure, 22 tests of recorded hands. Two choices
  went into the spec: a strip under another of our windows takes nothing,
  and a chip docks 8 px inside a catch zone and leaves 8 px past it.
- W5b: proved in the lab: a layer page drew a window frame (the slate's
  radius, a shadow) with a 1:1 still of a hidden window's page and a
  chip's still. Two stills took 21 ms; the layer's first frame, 115 ms
  from nothing. 120 hand positions sent at 120 Hz arrived coalesced to
  the latest (71 drawn, the last one last). From the page's send to the
  layer's script placing it took 5 ms at the median and 9 ms at p95;
  with the frame the screen adds, that is inside the two-frame budget,
  so no message port yet (W5c measures it with a real hand). A motion
  reversed after 300 ms started from where the frame was. The flight's
  end closed the layer.
- W5c: proved in the lab with mouse input sent to a hidden window. The
  chip bands and tears at 24 px; the strip hides it only once the layer
  has painted it, and closes up on `travel`. The preview unfolds from the
  chip's 166 px to the window's 1100 px in about 400 ms on `unfold`, the
  window's still held in place around the chip. Over its own strip it
  folds back and the others make room; let go there, it lands at its
  slot. Esc flies it home: the frame folds to the chip and the hand lands
  on its old place in about 400 ms, the tab back on stage. Let go in the
  open, a window opens on the preview's frame to the point, and the still
  goes once that window says it has drawn: 1.25 s after the drop, which
  W5e's warm window is for. `land` and `nudge` are springs with no
  written-out timing, so the flight samples them (`motionTiming`).
- W5e: proved in the lab under the lab helper. The warm window's page
  starts 40 ms after the tear, as a page of its own outside the book,
  with the carried tab, not leading, and the source without the tab among
  its others. Esc destroys it with the layer. On a drop the same page
  becomes the new window, at the asked frame, and the source's still goes
  30 ms after the drop when the warm window has drawn (1.25 s before). In
  the dev build it draws its tab 1.05 to 1.4 s after the tear, so a quick
  drop hands off then: 0.8 s after a drop 0.24 s into the carry, 0.18 s
  after one at 0.8 s. A release build's boot is unmeasured; the hand
  check (below) says whether a quick drop's wait shows.
- W5d: proved in the lab. Carried by its only chip, a window moves with the
  hand: the chip lifts and no layer opens. Let go, it stays. On Esc its
  still starts where the hand had it and lands on its old frame in about
  475 ms on `land`, then the layer goes; under Reduce Motion the still
  fades in place. The lab helper keeps windows off the screen, so the
  window's own moves are read from the still's frames; that the chat keeps
  drawing in the hand is for the hand check.
- W6a: proved in the lab with two windows side by side (the lab helper
  stacks windows at one edge, so the source was made narrower than the
  host, whose strip then stood clear of it). Torn off and carried over the
  host's strip, the chip folds and the host's chips at and after its slot
  slide over by its width and gap (164 px). Let go, the tab joins the host
  at that slot and is on stage there, its chip painted hidden at once; the
  chip lands on it in about 475 ms, the host shows its chip, and once it
  has drawn the layer goes. Esc over the host's strip flies the chip home
  and the host's chips glide back. The pick-up asks the other windows to
  measure their strips (main places them on the screen from each window's
  content bounds and zoom, `strips.ts`); a page that doesn't answer in
  150 ms takes no drop. Spring-load's raise (`moveTop`, no focus) is a
  no-op under the lab helper: for the hand check, with the engine's tests.
- W6b: proved in the lab. A one-tab window carried over another window's
  strip comes onto the layer as its still, hides under it and folds into
  its chip while the host makes room. Carried back out, the still unfolds
  and the window, kept under the hand all along, shows again as the layer
  goes. Let go in the strip, the tab joins the host at the slot and is on
  stage there; the window that carried it closes as the layer goes, once
  the host has drawn the chip (about 520 ms after the drop). Main holds the
  close of a window whose page is flying the tab until its flight ends.
  Esc over the strip flies the still home, opening into the window, which
  shows there.
- W6c: proved in the lab. ⌥⌘Z after a tear closes the new window and puts
  the tab back at its place; after a one-tab window joined another, it
  reopens that window with its tab and takes the tab back out; with
  nothing kept it does nothing. After ⌥⌘T and a tab opened in the new
  window, ⌥⌘Z forgets that move and changes nothing.
- W6d: proved in the lab: a window closed as its page does when main hands
  it the close goes, and ⌥⌘Z reopens it with its tab. A scratch window
  showed main's `close()` (the red button's path) can be held and a page's
  own `window.close()` can't; the lab can't press the red button, so the
  hand-off itself is for the hand check.
- W8a: proved in the lab with three windows. Each showed Gather. Pressed
  in the middle one, it took every tab, the others closed, and its button
  turned to Put back, the memory kept for the display set. ⌥⌘G put the
  three back with their tabs and spent the memory; ⌥⌘Z twice gathered them
  again and then took the gather back. Closed down to one window with no
  memory, the button went; ⌥⌘Z reopening a window brought it back. The
  lab helper stacks windows at one edge, so frames put back are proved by
  the round-trip tests, not here.
- W8b: proved in the lab by sampling the layer every 30 ms. Pressed,
  the two other windows were on the layer 200 ms later and closed under
  their stills, and the home strip held their four chips hidden. The
  nearest still shrank onto its chip on `travel` and the next left 120 ms
  later onto the rect around its two chips; each ended exactly on the
  chips' screen rects. Each chip showed as its still began to fade, and
  the layer went 890 ms after the press. Under Reduce Motion the stills
  faded where they were, 120 ms apart, gone at 560 ms.
- W8c: proved in the lab the same way. Pressed, the chips were on the
  layer at 200 ms and hidden in the strip; the farther window's frame
  unfolded from its two chips to its old frame, the other 120 ms later,
  each ending on its frame with its chips on the window's first chip
  place. The two windows opened under their frames at 950 ms, drew, and
  their frames faded; the layer went at 3 s (the dev build's boot). Under
  Reduce Motion the windows opened with no layer. ⌥⌘G, ⌥⌘Z and the
  button's offer behaved as in W8a around both flights.
- W7a: proved in the lab with a stand-in handle in a pane (the lab's
  chats are made up, so none has a line over its composer) pressed by
  mouse input. Past 4 px the card was under the hand and the pane's place
  empty; over the other pane the wash lit the half nearest the hand (left,
  right, above, below). Let go, the chat took that half and the card
  landed on its new place in about 500 ms on `land`, then the pane showed.
  Esc, or letting go over its own place, flew the card back. ⌥⌘Z put the
  chat back. Under Reduce Motion the card faded where it was. The Cell as
  the handle in a sent chat is for the hand check.
- W7b: proved in the lab the same way. Resting on another tab's chip for
  700 ms opened that tab, and the chat then landed on a half of its pane.
  Past the last chip the + moved over by a chip (164 px); let go, the
  chat became a new last tab, its chip hidden until the card landed on it
  (500 ms), and the tab it left, now empty, closed. ⌥⌘Z put it back. Let
  go on a chip after a tab sprang open, the chat's own tab came back on
  stage and the card flew home.
- W7c: proved in the lab at 120 Hz with a lab chat: a flick into a wall, a
  lob, a throw to the top, a plop and a catch mid-air flew with no
  dropped frames; Esc and Reduce Motion went home (`tasks/cell-toss.md`,
  The flight, Review).
