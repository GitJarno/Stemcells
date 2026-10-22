# A file carried over the slate

The Mac app's drop visuals, ported: what a person sees while carrying a
file over Stemcells' chats and tabs.

## Plan

- [x] Upstream first: a file dragged over a chat makes upstream's thread
      view draw an overlay of its own (a dashed frame round a "Drop files
      to attach" pill, inset 8 px, square to the slate). That chat is the
      one a drop lands in, so the slate follows it rather than guessing
      (`upstream/drop.ts`, pinned by `drop.contract.test.ts`). In a pane
      the overlay's picture steps aside (opacity only: its status still
      reaches screen readers), so there is one highlight, not two.
- [x] The wash (`tabs/DropWash.tsx`, `tabs/washShape.ts`): one shape for
      the whole slate, drawn 1 px inside the chat that would take the
      file, in its tone (the accent until Cells have tones of their own)
      at a quarter of a tint, inside a hairline at a tint's edge. Its
      corners round, by the slate's radius less the inset, only where the
      pane's corner is the slate's (changed 2026-10-23: white, a sheet
      6 px inside with round corners, `chat-carry-polish.md`). Crossing to
      the next chat glides it
      there (travel); lighting afresh fades it in (flick); leaving or
      letting go fades it out where it was (fade). Under Reduce Motion it
      only fades. No label, no dimming, no stitching.
- [x] The composer the file would land in rises 1 % from its foot (settle)
      and eases back; not under Reduce Motion.
- [x] Spring-loaded tabs (`tabs/springTab.ts`): a tab a drag comes over
      lights (the drop-target colour at a tint, in the tab's shape) and
      opens after the spring-load rest (350 ms), so a file can be carried
      to a chat on another tab. The tab already open never lights.
- [x] Not ported, on purpose: the Mac's halo round an empty surface and
      its "nearest chat takes a drop on a gutter". Nothing on the slate
      takes a drop that no chat claims, so a halo would promise a drop
      that misses. The composer's ghost tile and drop shadow wait for the
      composer's glass, which owns the composer's look.
- [x] Proved with synthetic drags in the dev app (headless): one wash at
      a time, the glide between chats, corners at the slate's curve, the
      tab lighting then opening, the fade when the drag leaves.

## Review

- Synthetic drags in the dev app (headless Chromium, three Cells, one
  stacked): a file over the left Cell lights one wash with the slate's
  left corners; carried to the bottom-right Cell it glides there (caught
  mid-way with animations slowed) and lands with only its bottom-right
  corner round, 1 px clear of the hairlines; upstream's overlay is there
  but unseen, and the composers' scale goes 1.01 → 1 on the left and
  1 → 1.01 on the right. Resting on Aski's tab lit it while the wash faded,
  and it opened after the rest; over Aski's chat the wash took all four
  corners; leaving the window faded it out. Under Reduce Motion the
  crossing jumps and fades in, and nothing lifts.
- The first build guessed the overlay had mounted a frame after the drag
  event; React sometimes mounts it later, so the wash now watches the
  slate for the overlay while a drag is over it.
- `DropWash.tsx` beside a `dropWash.ts` resolved to the wrong file on a
  case-insensitive disk; the geometry is `washShape.ts`.
