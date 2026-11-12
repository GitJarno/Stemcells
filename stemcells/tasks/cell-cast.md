# The cast: a look for every name

The wardrobe before this dealt each Cell one of sixteen single pieces by a
hash of its chat's id, and a season's item over it for most of the year.
Nothing a Cell wore said who it was, and the app never passed the deal a
theme, so about seventy of the original's pieces and twelve drawn outfits
(classes, gym, workshop) were never worn.

## The rules

1. **A Cell wears the look of its name.** There are 110 names
   (`stemcells/words/cellNames.json`). Each has one look, drawn for it: Fox
   the fox hood, Pancake the stack, Squire the knight's plate. The name is
   already beside the Cell wherever it shows; now the picture says it too,
   on every screen, with nothing stored.
2. **The cast is data.** A pack marked `"cast": true` holds looks as outfits
   whose `id` is the name in lower case. One silhouette piece, at most one
   supporting piece. `cast.json` dresses names from art that existed; the
   `cast-*` packs draw the rest, one family a file.
3. **Motion stays the temperament's.** A cast look has a cheer only where the
   cheer is the joke (Squire raises the sword, Ukulele strums). Every other
   landing plays the Cell's temperament.
4. **A season is dress-up days.** A window of three weeks or less, or a
   longer window's named feast, dresses every Cell. Through the rest of a
   longer season a Cell dresses for it one day in three, on days of its own,
   so a crew in November is mostly itself with a raincoat or two.
5. **A season's outfit is worn alone; a season's piece shares.** An outfit is
   a whole look and takes the place of the Cell's own. A single piece (the
   original's season packs) leaves the own look the slots it doesn't fill.
6. **The outfit theme is gone.** It was the original's setting; nothing here
   set it.

## Plan

- [x] The deal (`cell/looks.ts`): own look by name, dress-up days, feasts,
      twins apart by colourway; `Pack.cast`, a season's `feast`
- [x] `cast.json`: 42 names from the original's pieces and the drawn outfits
- [x] `cast-burrow`, `cast-pack`, `cast-shore`, `cast-garden`,
      `cast-kitchen`: 68 names, drawn
- [x] `cells cast`, and the cast's rules in `cells check`
- [x] Tests for each rule; the original's deal fixture retired with the theme
- [x] Proof: the cast line-up on every body and both frames; a crew through
      a plain day, a long season and a feast; the dev app

## Review

- The 68 drawn looks came from five drawings made side by side, one family
  a file, each carried through its own rounds of redrawing, then judged
  together on one sheet. Two were redrawn after that look: the otter (a
  hood that read as a wig became an otter sitting up with its shell) and
  the peanut (two lobes with a waist).
- Three hoods as wide as the miniature warn in the scenes that lean, as
  the original's own hoods do. Nothing fails.
- Two chats can draw one name. They then wear one look, apart only where it
  has colourways: most cast looks have none. Dealing names apart is the
  fix, and its own change.
- A season's outfit now takes the place of the own look where the first
  build stacked them: stacked, a December coat over a knight's helm read as
  neither.
- An independent read of the deal found that a Cell forgot things while in
  view: a twin lost its colourway after a day in a season's outfit, and a
  Cell could change its season's outfit between dress-up days. A look now
  carries what it has put by (`Look.held`), with a test for each.
- Not done here: the earned pieces and lineage colourways of
  `cell-life.md`, and a card that names what a Cell wears.
