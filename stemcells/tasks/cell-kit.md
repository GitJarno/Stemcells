# The Cell, ported

The Cells in the tab strip and on the composer were a 13 × 10 redraw: one
flat ink, eyes cut as holes, hats pasted over the box, no moves. This ports
the original Swift app's Cell instead: its sprites, palette, rig, fabric,
wardrobe, packs and moves, drawn per surface the way that app drew them.
Data is exported once from the original sources (by a tool kept outside the
repo); the rig and compositor are ported to TS and proven against frames the
original app composed.

## Slice 1 · The Cell kit

- [x] Export the kit as JSON (`cell/kit/`): palette, body and rig, faces,
      wardrobe library (fabric, trim, tools), packs, every move as rig poses.
- [x] Port the rig (hero and miniature from a pose, headroom fit, seated
      props), the compositor (anchors, depth, narrowed bodies, features),
      fabric, the wardrobe's layers, a move's frames, scenes (animated
      pieces folded in, the miniature's hero detail, the blink variant).
- [x] Parity: every frame the original composed for a matrix of looks and
      scenes, hashed (`cell/kit/fixtures/parity.json`), matches ours.
- [x] No surface changes yet. Tests, types, lint, drift.

## Slice 2 · The figure draws it

- [ ] `CellFigure` paints kit frames: the hero art wherever half a cell is
      whole device pixels, else the miniature; the provider's palette; a
      fixed 13 × 14 box; a seeded blink, a caret blink while it needs you.
- [ ] Same props. Moods map to scenes: awake → listening, needsYou → the
      plea, asleep, pleased → the cheer, crashed → the dizzy face held,
      braced → the squeeze held.
- [ ] Dealing reads the kit's packs; `CellMark` stops padding for hats and
      passes the provider.
- [ ] The 13 × 10 art goes. Proof sheet of old and new.

## Slice 3 · It acts

- [ ] The activity of the call in flight from the thread (adapter and
      contract test), shown after 3 s, held 8 s.
- [ ] The cheer when a turn lands, then rest; asleep after a while idle.
- [ ] One beat clock for every Cell, still off screen and under Reduce
      Motion.

## Review
