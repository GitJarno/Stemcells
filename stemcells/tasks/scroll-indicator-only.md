# No scroll bar; T3's indicator only

the person: "We should only have the T3 scroll indicator, no scroll bar at all.
Show the indicator on scroll and make it go away after while the scroll
stops." The rail of #163 (a 3px thumb at the chat's right edge) goes, and
so does every other bar in the app. T3's ask marks (its timeline minimap)
are the chat's one indicator.

## Plan

- [x] No bar anywhere (`scrollbars/scrollbars.css`): `scrollbar-width:
      none` on every element (important: upstream asks for a thin one on
      code blocks in a rule that outranks a universal one), Base UI's own
      bars and corner hidden by `data-slot`, the terminal's ARIA scrollbar
      seen only in keyboard focus (it still scrolls by keys), the diff and
      file-tree views' shadow roots through their gutter override
      properties. #124's `scrollbar-color` on the root goes: it inherited
      into those shadow roots and turned their bar rules off.
- [x] The marks hidden at rest, shown while the reader scrolls
      (`scrollIndicator/`): #163's clock (a wheel, finger, key or press
      makes the next 400 ms of scrolling the reader's; a reply followed to
      its end isn't), half `--sc-timing-linger` after the last scroll, and
      Motion's fade and recede. Held under the hand and in focus; half a
      linger after the hand leaves. No part of them takes the hand while
      hidden. Never in a chat too short to scroll. Reduce Motion: no
      transition, same show and hide.
- [x] Mirrored to the right by the marks' test id and `scale: -1 1`, not by
      Tailwind classes; the preview turns back to read.
- [x] Keys on the page (focus left on the body by a click in the chat)
      count for the focused pane, as upstream's own key scrolling does.
- [x] Deleted: the rail, `rail.ts` and its test, its contract and adapter,
      the `--sc-scrollbar-*` tokens (the skins' too), the settings rail and
      its `position: relative`, the table bar kept shown in a pane, and the
      `scrollbar-width: none` lines the global rule makes redundant. The
      chat column's clip stays (the halo reaches past the pane's foot), now
      beside the halo in `glow.css`.
- [x] Contracts hold on main and on `upstream/main`, where the marks moved
      to `TimelineMinimap.tsx`.
- [x] Proof in the never-shown desktop lab (`stemcells/lab/electron dev`,
      driven over its own debugging port, a copy of real chats).

## Review

In a 1100x780 lab window, on a chat of ten asks:

- At rest no marks and no bar: every one of the page's 1,356 elements has
  `scrollbar-width: none`, and no scroller keeps any width for a bar.
  Under the hand, the hidden marks' strip passes it to the chat.
- A wheel fades them in (fully shown 250 ms on); 1 s after the last
  scroll they are gone. A script's scroll (a follow, a restore) shows nothing. PageUp
  shows them too.
- On a dash, the preview opens leftward and reads. It held 1.5 s past the
  clock under the hand, stayed 0.6 s after the hand left, then faded.
- Reduce Motion: shown and hidden at the same moments, with no transition
  (the shown state's fade had outranked the first reduced rule; fixed).
- No bar while scrolling: the left column's list (a short window, 172 px
  scrolled), Settings (600 px), the terminal (its ARIA bar invisible and
  passing the hand to the canvas; seen when it takes keyboard focus), the
  file tree (600 px, in its shadow root, 0 px gutter) and a file's code
  view (0 px gutter; pierre's default is 6 px).
- Beside the right panel the chat is narrow and upstream gives the marks no
  room of their own, so while scrolling they overlay the lane's last few
  pixels, as an overlay scroll bar does, and go with the scroll.

Left as they are: what a web page draws inside the browser panel, and the
phone's native scroll indicators.
