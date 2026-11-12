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
4. **A season is dress-up days.** A window of twenty days or fewer, or a
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
- [ ] `cast-burrow`, `cast-pack`, `cast-shore`, `cast-garden`,
      `cast-kitchen`: 68 names, drawn
- [x] `cells cast`, and the cast's rules in `cells check`
- [x] Tests for each rule; the original's deal fixture retired with the theme
- [ ] Proof: the cast line-up on every body and both frames; a crew through
      a plain day, a long season and a feast; the dev app
