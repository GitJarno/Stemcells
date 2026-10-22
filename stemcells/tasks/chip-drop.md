# A chat dropped on a tab

A Cell carried by its handle (`windows.md`, Carry a chat) and let go on
another tab's chip goes into that tab, and the person stays where they
are: the tab on stage stays on stage, the window in front stays in front.
It works on the chips of the other windows too, so a chat in a window of
its own can go back into a tab of the main one.

## Decided

- **Where it lands:** at the tab's end, the way the tab holds its panes
  (`addPane`'s rule from its last pane): beside the last pane when its
  row has room for a Cell's column, else under it. The tab's own focus
  stays.
- **The person stays.** A drop on a chip never changes what's on stage or
  which window is in front. A tab sprung open on the way gives the stage
  back. One exception: when the chat was its tab's last, that tab is gone,
  and the person follows the chat (its tab on stage, its window in front,
  the chat focused).
- **Lit means "a drop lands here".** The chip under the hand lights for
  any tab but the chat's own, sprung open or not. Spring-load stays, so a
  chat can still be put beside a particular pane in another tab.
- **Other windows:** their chips only (W7d's strips, not their panes or a
  new tab there). The card goes onto the flight layer once it leaves its
  window, the chip under the hand in the other window lights, and nothing
  raises that window. Aski's chip takes no chat there either.

## Plan

- [x] `joinTab` (layout): a pane to a tab's end, focus and stage kept.
- [x] `carry` to `{ kind: "tab" }` (moves): stays or follows as above.
- [x] In-window: a drop on another tab's chip moves the chat there; the
      card lands on the chip; the chip lights whenever it would take it.
      A let-go over a chip drops, however fast: it aims, it doesn't throw.
- [x] Other windows' strips measure each tab's row width; their chips
      light for a chat carried over them (`Visit` `lit`), and go out at
      the let-go.
- [x] The card on the flight layer outside its window (`cardFlight.ts`):
      its still is taken the first time it would leave, the page's card
      kept whole at the window's edge until then, the layer's catching up
      to the hand on `nudge`. A carry that stays in its window takes no
      still. The drop on another window's chip; a miss flies it home.
- [x] Tests: `joinTab`, `carry` to a tab (stay, follow, refusals, the
      random walks), the elsewhere hit test, the measured row widths, the
      chip drop and the own chip in the browser.
- [x] `windows.md` W7b/W7d updated.
- [x] Proved in the lab (below).

## Review

In the desktop lab (dev app, fake providers, five sent chats, two and
then three windows, mouse input over CDP):

- In one window, resting 700 ms on another tab's chip: it lit and sprang
  open; let go there, the chat went to that tab's end, the tab kept its
  focus, and the stage and address went back to the tab the chat left.
- From a window to another's chip, its tab keeping a chat: the chip lit
  in the other window while the hand rested; let go, the chat joined that
  tab, neither window's stage changed, and the window carried from stayed
  in front.
- A one-chat window (torn off with ⌥⌘T) onto the main window's chip: the
  chip lit, the chat joined the tab, the one-chat window closed after the
  flight, and the main window came forward with that tab on stage and the
  chat focused.
- Flicked out of its window in about 100 ms: the page's card hid, the
  layer took it, the drop landed, and the layer was gone after.
- A carry that stays in its window opened no layer; a let-go over another
  window's content flew the chat home and the layer went.

The lab's windows sit off every display, so the layer's own picture of
the card isn't captured there: how it looks between windows is for the
hand check. The lab pins every window's right edge to one place; windows
of different widths were how the hand got outside one and over another.

Found on the way and fixed: a chat let go on the near half of the pane
beside it, landing where it was, recorded a move that Undo Move then
refused (`moves.test.ts`). A thrown Cell now ends its carry through the
same `finish` as every other let-go (`tab-click.md` found the leak).
