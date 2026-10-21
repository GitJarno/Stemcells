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
- [ ] W2 More than one window (desktop + web): our desktop layer, three
      seams, the boot handshake, the tab store reading its window's slice,
      Move Tab to New Window (⌥⌘T, no motion yet), closing a window, Aski
      going home, relaunch. Measured: memory, boot and server load per
      window.
- [ ] W3 Shared state across windows: drafts, right panel and terminal UI
      merge on `storage`; notifications from the lead window only; a chat
      open in another window raises that window.
- [ ] W5 Tear off: the carry engine, the flight layer, the tear band, the
      chip unfolding into a window preview, the drop in open space,
      Esc, the one-tab window, mid-flight reversal, Reduce Motion.
- [ ] W6 Into another window's strip: geometry, making room, spring-load
      raise, landing; Undo Move (⌥⌘Z).
- [ ] W8 Gather / Put back: the button, ⌥⌘G, memory per display set,
      the flights, full screen restored.
- [ ] W7 Carry a chat: the Cell as the handle, pane halves, tabs, strips,
      windows and open space.
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

**The lead window** is upstream's main window. Notifications, Aski's
keeper and, later, the phone's publishing run there only. When it closes,
our layer promotes the frontmost window with upstream's `setMain`, so the
menu, reload and dev tools keep a target.

**Persistence.** Main writes `stemcells-windows.json` in the desktop state
folder (`windows/persist.ts`'s format: the windows, the lead, the memories
and the displays last seen), debounced, and flushes it on quit. The undo
stack isn't kept. At launch main opens every stored window at its frame at
once, and the lead window runs `displaysChanged` against the displays last
seen, so a display gone since gathers its windows. The first desktop boot
with no file adopts the old `stemcells.tabs` from the renderer's
localStorage as window 1. Upstream keeps saving window 1's bounds as it
does; ours agree with it. The browser build stays one window on
localStorage, running the same functions over a one-window arrangement.

**Boot.** A window learns who it is synchronously: our preload asks main
once (`sendSync`) and gets its id, its workspace and whether it leads,
before the app's scripts run, so the tab store's first read stays
synchronous. Main knows the asker by its `webContents`; no id rides the URL.

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
   make: hidden, holding the tab, provisional (it writes no drafts, raises
   no notifications, takes no focus). If the carry ends anywhere else, it
   closes. W5 measures its boot; if a warm boot is over `dwell` (400 ms),
   one blank spare stays booted after the first tear.
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
3. Held over a strip for `spring-load` (350 ms) whose window isn't in front
   of the others under the hand, that window comes forward without taking
   focus. We can see only our own windows' order; a strip under another
   app's window still takes the drop, and the window comes forward as it
   lands, so the landing is never hidden.
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
host has painted the tab. Esc flies it home on `land` as a still, then sets
the window there and shows it.

macOS tiling (dragging a window to a screen edge) works only for the
system's own title-bar drags, which this isn't; the strip's empty space
still drags the window natively.

### Carry a chat

The handle is the Cell: its mark at the start of the line over the
composer. A pane has no header, the Cell is the chat's identity, and
picking up the Cell to carry the chat reads as what it is.

1. **Pick up** (4 px). The pane gathers into a card under the hand, the
   Cell's mark and name, on `lift`. Its place in the grid stays, empty, so
   a cancel has somewhere to land.
2. **In its own window**, today's drop machinery answers: a pane's half
   lights with the wash (`DropWash`, gliding on `travel`); a chip lights and
   opens after `spring-load`; the strip makes room for a new tab (`travel`).
3. **Out of the window**, the card hands off to the flight layer as a
   still. Over another window, main relays the hand to that window, whose
   wash and strip answer exactly as at home; its window comes forward after
   `spring-load`.
4. **Open space**: the card unfolds into a window preview holding one pane
   (`unfold`), then lands like a torn tab.
5. **Drop**: the card lands into its half, slot or window on `land`. The
   source grid reflows (`reflow`, instant by design). A tab whose last pane
   left closes (`leave`); a window whose last tab left closes.
6. **Cancel**: the card flies back and opens into its place on `land`.

Before the source lets go of a pane, its pending draft write is flushed,
and the carry is marked so upstream's drop-left-draft cleanup doesn't
delete a draft that is only moving.

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

### Undo Move (⌥⌘Z)

Every move above, and closing a window, pushes its inverse. Undo Move
plays it with the move's own motion reversed, as long as every tab and pane
it names still exists where expected; otherwise that entry is dropped and
the next one is offered. ⌘Z stays the composer's.

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
card ↔ pane) becomes a cross-fade (`fade`); every flight becomes a fade
out where it was and a fade in where it lands; strips making room jump
(`cut`). Gather and Put back fade each window out and in, one `beat`
apart.

## The flight layer

A transparent, click-through, unfocusable, always-on-top window per
display, made the way the snapshot overlay already makes one
(`snapShot/SnapShotTransition.ts`), visible over full-screen Spaces.
Created on the first carry, hidden between flights, kept.

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
  holds it; closing that window sends it home.
- **Settings** is upstream's route, not a tab. Each window can show it
  (⌘,) today. W11 makes it a tab so it tears off like one; it starts with
  a spike: upstream's settings pages rendered inside a tab page under a
  memory history. If they need the window's own router, Settings gets a
  window of its own instead, opened from the same key.
- **The phone** mirrors tabs, not windows: one flat order, the lead
  window's tabs first, then each other window's by screen position. The
  phone has no tabs endpoint yet; this waits for it.
- **Notifications** mount once per renderer upstream: N windows, N
  notices. A substitute renders upstream's coordinator in the lead window
  only.
- **Shared localStorage.** Upstream's drafts, right panel state and
  terminal UI state are each one key, written whole by every window, so
  windows overwrite each other. Our adapter listens for `storage` and
  merges: per chat, the window holding the chat wins; a merge that changes
  nothing doesn't set state, so two windows can't ping-pong.
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

Today: 69 upstream files changed, 670 lines, 8 hot (`drift`, 2026-10-21).

| File                                                | Change                                                                                                                                                                | Heat (90 d) | Slice        |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------ |
| `apps/desktop/src/main.ts`                          | Adds our windows layer to `layerDesktopApplication`                                                                                                                   | 28          | W2           |
| `apps/desktop/src/preload.ts`                       | Imports `stemcells/preload.ts`, which exposes `stemcellsBridge`                                                                                                       | 40          | W2           |
| `apps/desktop/src/window/DesktopWindow.ts`          | `createWindow` takes a frame and a role; an extra window skips the main window's bounds saving, preview registration and dev tools; the service exposes `createExtra` | 31          | W2           |
| `apps/desktop/src/preview/Manager.ts`               | Accepts webviews hosted by any of the app's windows                                                                                                                   | 57          | W4           |
| `apps/desktop/src/window/DesktopApplicationMenu.ts` | Window menu: Move Tab to New Window, Gather Windows / Put Windows Back, Undo Move                                                                                     | 11          | W8, optional |

After: 74 files, about 715 lines, still 8 hot; every new seam is cold.
Our IPC channels are our own strings in our files, so `packages/contracts`
isn't touched. The web side needs no seam: notifications go through a
substitute, the strip and keys are ours, the stores merge in our adapter.
`createWindow` is reused, not copied, because it installs upstream's
webview hardening, popup handling, navigation guard and renderer recovery,
and a copy would drift silently.

Before W2 adds the preload line, it tries `session.registerPreloadScript`,
which would need no seam at all, if it reaches the app's window and nothing
else.

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

**Frames in the dev app, off the person's screen.** A dev-only lab mode in
main: every window and flight layer is created hidden, painting while
hidden and never focused, on a virtual pair of displays. A driver feeds
recorded hands to the source renderer's engine (the cursor never moves).
Each frame, main captures every window and layer with `capturePage` while
hidden and composites them at their virtual places into
`/tmp/stemcells-windows-*.png`, with motion slowed. W2 first proves hidden
windows paint and capture; if they don't, the lab uses offscreen windows on
a virtual display layout instead.

What the frames must show: no frame without the carried thing; the
preview's chip under the grab point; the drop landing on the preview's
frame to the pixel; the host making room and the chip landing in its
slot; the warm window under the still before the fade; Gather's stagger.

**By hand, once merged and installed:** tear off and drop on another
display; drop into another window's strip; carry a chat to a pane half in
another window; Esc mid-carry; Gather, Put back, Gather; unplug and replug
a display; relaunch with three windows; a browser pane moved; Reduce
Motion on.

## Review

- W1: the moves, Gather, Put back and the display changes are pure
  functions over plain values, proved by hand-built cases and by seeded
  random arrangements and walks of 25 moves (every step whole, every step
  undoable). A transaction is whole values per window, not edits, so the
  desktop app needs no layout logic to route it.
