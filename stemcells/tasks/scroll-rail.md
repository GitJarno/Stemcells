# The chat's scroll rail

Superseded by `scroll-indicator-only.md`: the rail is gone, and no bar
draws anywhere.

the person's chat showed the system's scroll bar: on a Mac set to show scroll
bars always (or with a mouse attached), a wide gray track the chat's whole
height, running into the slab's rounded corner, under the pane's buttons and
past the composer. `scrollbars.css` set `scrollbar-color` on the root, so
Chromium drew the system's bar, which is an overlay bar or a classic one,
depending on the Mac's setting. T3's ask marks (its timeline minimap, a dash
per ask) stood on the left. He asked for one high-taste indicator, T3's, on
the right, which works at small widths too.

## Plan

- [x] Reproduce: headless Chromium with `-AppleShowScrollBars Always` (a
      wrapper passes the Cocoa argument) draws the classic bar and takes
      15px out of each edge of the transcript. Plain headless draws the
      overlay bar, the "When scrolling" setting.
- [x] The rail (`scrollRail/ScrollRail.tsx`, `rail.ts`): a port of the Swift
      app's `ChatScrollRail`. One thumb at the right edge, between the
      buttons' band and the composer. It shows while the reader scrolls (a
      wheel, key or press of theirs, not a reply the list follows to its
      end) and fades after half of `--sc-timing-linger`. Under the hand it
      widens over its track. It drags, and a press on the track glides
      there. A wheel over it scrolls the chat. Reduce Motion jumps.
- [x] The system's bar never draws over a pane's chat or the settings page
      (`scrollbar-width: none`), so nothing depends on the Mac's setting
      and no width is kept out of the content.
- [x] T3's ask marks stand at the right beside the thumb, mirrored from
      upstream's left at upstream's own distances (`scrollRail.css`). Where
      the lane's room is too small for them, upstream already hides them.
- [x] Tokens by role (`--sc-scrollbar-*`), from the theme's foreground, so
      dark and light both read.
- [x] The settings page on the slab gets the same rail, clear of the
      slab's rounded corners.
- [x] The chat's column (`[data-chat-column]`) is clipped in a pane. The
      composer's halo (`glow.css`) reaches 36px past the pane's foot, and
      upstream lets the column scroll, so on "Always" a second full-height
      bar stood at the pane's edge and took 15px out of the chat. On the
      overlay setting a wheel over the composer scrolled the whole chat up.
- [x] A press on the rail tells upstream what a press on a native bar tells
      it: a pointerdown whose target is the transcript. That ends live
      follow, as a native bar's press does, so a press at the end glides
      instead of being pulled back. The glide runs on `--sc-motion-travel`
      by share of the way, since rows measured on the way change the length.
- [x] Pinned: `upstream/scrollRail.contract.test.ts`; `scrollRail/rail.test.ts`
      tests the thumb, the drag, the glide's share and the track's ends.
- [x] Proof: widths 800, 480, 320 and 160, side by side and stacked, dark
      and light, "Always" and "When scrolling".

## Review

The rail is the only bar on a pane's chat and on the settings page, and it
looks the same whatever the Mac's setting. On "Always", main kept 15px out of
each edge of the transcript for its bar, and the chat's column drew a second
bar beside it. Now the lane is the same on both settings: 104..808 in an
800px pane. The thumb is 3px at rest and 6px under the hand, 4px in from
the edge. It runs from under the buttons' band to 6px above the composer.
T3's dashes stand beside it where the lane has room, as in an 800px pane.
In narrower panes they show on hover, by upstream's own rule, and in panes
of 480px and less not at all.

From the end of a chat, a press near the track's top glides to the top
(scrollTop 1817 to 0), and a drag to the track's foot lands at the end. A
wheel over the rail scrolls the chat.

Left as they were:

- Code blocks keep upstream's thin system bar, which on "Always" sits
  under a wide block.
- Tables keep upstream's ScrollArea bar.
- The left column hides its bar already.

Found on the way and opened separately: since #128, every pane's chat sat
8px right of centre and 36px down (`pages/frame.css`).
