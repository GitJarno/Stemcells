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

- [x] `CellFigure` paints kit frames on a canvas: the hero art wherever half
      a cell is whole device pixels, else the miniature; the provider's
      palette (`useCellDriver`); a fixed 13 × 14 box; a seeded blink, a
      caret blink while it needs you (proven against the original's blink).
- [x] Same props, less the hue. Moods map to scenes: awake → listening (or
      the activity it is given), needsYou → the plea, asleep, pleased → the
      cheer, crashed → the dizzy face held, braced → the hunker held.
- [x] One beat clock for every Cell: 12 a second on the wall clock, still
      off screen, in a hidden window and under Reduce Motion.
- [x] Dealing reads the kit's packs; `CellMark` stops padding for hats and
      passes the provider.
- [x] The 13 × 10 art goes; the mark in one ink (the composer glass's
      fallback) and Aski's stage draw from the kit. Proof sheet of old and
      new, and the live app checked: tab and composer, Codex's colours,
      frames moving, still under Reduce Motion.

## Slice 3 · It acts

- [ ] The activity of the call in flight from the thread (adapter and
      contract test), shown after 3 s, held 8 s.
- [ ] The cheer when a turn lands, then rest; asleep after a while idle.

## Review
