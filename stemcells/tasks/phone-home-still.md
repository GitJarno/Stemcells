# The phone's home holds still

The person's list (2026-10-30), from two phone screenshots of the home: Flying, and Needs
you while it synced.

## Causes

1. **Aski under the header.** React Native's iOS `scrollTo` stops at minus the scroll view's
   own `contentInset`, which is 0 under UIKit's `automatic` inset. So every scroll the code
   made towards the rest position (T3's list putting back a remembered offset each time a
   segment mounted it, the page's own scrolls) landed at 0, with Aski under the header. The
   remembered offset was T3's one per workspace tab, from whichever segment was scrolled
   last.
2. **"Working" on Flying.** T3's row says its status at its top right; on Flying the card's
   light already says it.
3. **The Loading row and the Settled count.** On the home's tabs every shelf of T3's list
   stood open, Settled too, so Flying's list read older settled Cells, 25 a page, until it
   had them all ("Loading", then "Show more"). Each page joined the home's Cells, so Settled
   counted up, and fell back when the list let them go.
4. **"KI".** On the Mac, renaming a tab of one Cell renamed its chat, and the chat's title
   is the one-liner the phone's card shows.
5. **The grey card.** The page under Needs you wrapped its scroll view in a view of the
   keyboard library's, so the header never found it. The blurred edges showed UIKit's plain
   grey material where iOS had dropped their blur, as it can when the app comes back.
6. **The greeting's flicker.** Aski's head mounts again with each page, and its line faded
   in on every mount.

## Plan

- [x] 1 Explicit rest: T3's list may scroll to its rest (`scrollToOverflowEnabled`); the
      page rests at 0 under its own top padding; each segment opens at its top (no
      remembered offset in the home, a list per segment)
- [x] 2 Flying's cards say nothing at their top right
- [x] 3 Settled's shelf open only on Settled; Settled counts the older ones the server keeps
- [x] 4 Mac: renaming a tab names the tab; the one-liner stays the chat's
- [x] 5 The page's scroll view is the header's; the blur comes back with the app
- [x] 6 Aski's head mounts as it stood: no fade, the same line
- [x] seams.md, tests, typecheck, lint, drift

## Review

Format, lint, typecheck, drift and the changed tests pass; the tab strip's new case fails on
the old strip. The rest is the phone's to show: Aski at rest under the header on every segment
and after a switch, no "Working" on Flying, no "Loading" outside Settled, a Settled count that
holds through a chat and back, no grey card after the app comes back, and the greeting still on
a switch. The two chats renamed from their tabs before this ("KI", "SC") keep those titles until
regenerated or renamed from the one-liner.
