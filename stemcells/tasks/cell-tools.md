# Cell tools: drawing new Cell art without a dev server

The kit (`apps/web/src/stemcells/cell/kit/`) is the original's art, exported
and never edited by hand. New art (packs, moves, temperaments) is drawn
beside it in `cell/art/`, one file per pack, move set or temperament, so
agents drawing in parallel never touch the same file. A headless toolchain
renders, checks and lays out that art from one worktree, with no dev server.

The formats carry what `stemcells/tasks/cell-life.md` §6 asks for. Using
the new data at runtime (outfits dealt as one, seasons that add, the
priority ladder, temperaments) is slice 4 and cell-life's integration; this
lands the formats, the compositor support the renders need, and the tools.

## Plan

- [x] `cell/art/` loaded beside the kit, in the browser (Vite's glob) and in
      node (the tools): packs, moves, temperaments
- [x] Formats: pack pieces in a `back` slot, posed variants (`poses`),
      `about`, fabrics, outfits with colourways, `silhouette` and `family`,
      pack cheers, `season.years`; move meta (`kind`, `priority`, `tier`,
      `lively`, `tell`, `next`, `land`, per-frame `dx`, `stage`; a second
      body is a layer in the body's letters); temperament records
- [x] The compositor wears the back slot (behind the body), a pack's fabric,
      and a piece's posed variant in the scene it names
- [x] The keyline pass for light frames, and the contrast measure
- [x] `stemcells/scripts/cells`: `render` (PNG, filmstrip, animated PNG, at
      hero and mini, on black and light), `check`, `lookbook`
- [x] `check`'s rules: the box and its ceiling, covered eyes, the mouth zone,
      outline contrast on both frames, fps on the beat, a `tell`, outfits
      apart, every letter a colour, frames that match
- [x] `stemcells/docs/cell-art.md`: the formats, the rules, the tools; the
      brief every drawing agent reads
- [x] Tests; the parity test still holds frame for frame
- [ ] The fan-out brief, sent to the lead

## Review

- The rules are the original's pack test, ported (rest pose, calm and open
  faces, `E` eye cells, luma 40 on black, the mouth zone of its sprite test),
  plus cell-life's: the share of the outline under 1.6 : 1 on both frames
  after the keyline, the beat, the tell, outfits apart. A first cut checked
  every scene frame by frame and flagged 47,000 cells of the original's own
  art; the original checks at rest, so failures are at rest and scene spills
  are warnings. The mouth zone holds headwear and back pieces: the
  original's wraps reach it (they are the trousers) and its face pieces are
  the face. On the original's art `check --original` gives 50 notes: 47
  pieces spill off the canvas in some scene (the plea's hop and the like),
  and 3 stay dim on light even keylined (blush, streamers, eggshell).
- `then` became `next`: an object with a `then` key is a thenable to the
  linter, and every literal holding one warned.
- A drawn pack or scene never replaces the original's: the kit drops it and
  `check` fails it.
- Year-dated seasons load and check but are not worn yet: `seasonOn` takes
  no year. Slice 4.
- Proved: the tools run in plain node (tested by spawning them), Vite's glob
  loads a real pack file (a throwaway `trial` pack, rendered, checked and
  removed), and the parity test holds frame for frame.
