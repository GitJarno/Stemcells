# Carrying a chat, polished

Asked (2026-10-23): a thrown Cell stays inside its chat; grabbing a Cell
no longer shrinks its chat into a card; a chat is carried by its Cell or
by its top; the place it would land lights white, not the accent's blue;
and the chats glide to their new places when one moves. High-taste,
cheap to draw, and it just works.

## Plan

- [x] **The toss stays in its chat.** The flight's arena is the Cell's own
      pane, not the slate; only a let-go with the hand inside that pane
      throws. Over another pane a fast let-go drops the chat there.
- [x] **White, not blue.** The drop wash (a carried chat, and a file) in
      the skin's white: a soft fill and a clear hairline.
- [x] **No minimize.** Picked up, the chat stays in its place and recedes;
      the card appears at the hand instead of gathering out of the pane,
      and leaves at the hand instead of growing back into it. A chat is
      also carried by a grip at its pane's top.
- [x] **The Cell in the hand.** Grabbed by its Cell, the Cell itself hangs
      from the hand (the toss's held pose), not a card; let go in its own
      chat it is thrown or set down, on a place the chat goes there and
      the Cell goes home.
- [x] **The chats glide.** A move inside the window morphs each pane from
      its old place to its new one (a view transition: snapshots on the
      compositor, one layout).

## Review

Five pull requests: #228 (toss bounded), #229 (white wash), #235 (no
minimize, top grip), #236 (the Cell in the hand), and the glide.

Seen in the never-shown lab with three seeded chats. A Cell thrown hard
at the pane's edge stays inside it: the box's right edge reaches at most
4 px short of the pane's edge. Carrying by the Cell and by the grip, onto
a half and into a chip, moves the chat; the Cell flies home in about
400 ms. Frames during a carry: median 8.3 ms.

A move into another column stalls the page while the moved chat remounts
there (upstream's chat view): 283 and 225 ms under Reduce Motion, 250, 75
and 67 ms with the glide, so the glide adds none. Keeping each pane's host alive across moves
(portals and `moveBefore`) would remove it, but that is a change of its own.
