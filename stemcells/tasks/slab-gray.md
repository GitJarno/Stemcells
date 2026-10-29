# A slate a touch lighter than the chats were

The slate read as the frame's black. Wanted: the colour of the strip that
showed beside it at boot, T3's canvas under T3's grain, so the slate stands
slightly apart from the frame. What stands on it keeps its step above it.

- [x] Measure the strip: T3's canvas (#0a0a0a) under `surface-grain` reads
      #0d0d0d on average at 1x and 2x (sd 0.95).
- [x] The slate is that, flat, as T3 lays its chat: the theme's canvas, its
      toolbar and its terminal (`apps/server/src/stemcells/look/theme.ts`).
- [x] Lift what stands on it by role, by the slate's own lift (1.33 times
      the light): cards, the composer, code, popovers and controls
      (#111111 to #151515); hover, what is picked, your messages (#141414
      to #181818); rules (#191919 to #1e1e1e); a field's edge (#1e1e1e to
      #232323). The needs cards and the folder tab read these roles.
- [x] Floors: body 17.8:1 on the slate; muted 4.99:1 on the slate, 4.69:1
      on a card, 4.56:1 on hover, with T3's muted ink unchanged.
- [x] Tests: the frame black and apart from the slate by more than T3's;
      every lifted role T3's step above the slate; the floors.
- [x] Proof, headless: before and after at boot, with two panes, swiped to
      Aski and back; 2x crops of the composer, the tab joint and the pane
      divider. Stemcells is dark only, so there is no light pair.
- [ ] Rebase on #171 and #174 once they merge, and shoot again.

## Review

The frame stays black under its grain (#030303 as it reads). The slate
goes from #0a0a0a to #0d0d0d, and the composer from #111111 to #151515.
A lighter Magma gray (#161616) was ported first and dropped for this,
The person's later pick.
