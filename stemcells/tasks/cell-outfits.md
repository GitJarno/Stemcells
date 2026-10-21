# Cell outfits: dealt as one, seasons that add, no two alike

Slice 4 of the Cell port (`cell-kit.md`), with the calls made on 21 October
(`cell-life.md`, Decisions). The art formats and tools are in
`cell-tools.md`; this makes the runtime wear what they carry.

## Rules

1. **A theme deals outfits.** A pack with outfits deals each Cell one outfit
   (in one of its colourways); a pack without (the original's) deals one
   piece, as today.
2. **A season is dealt first.** In a season, each Cell is dealt the
   season's item first, as the day's; the theme's item takes the slots it
   leaves free, the Cell's next one that fits when its first doesn't. The
   season's item is the one the original dealt, and the theme's piece it
   used to lose now shows wherever a slot is free.
3. **No two alike in view.** The Cells in view are dealt together, walked in
   the order they came into view. Each takes its highest-ranked item whose
   silhouette and colour family no other Cell in view wears; past the
   catalogue, the least worn. An original piece's silhouette is its own id.
4. **A Cell keeps its look while it stays in view.** Only newcomers move down
   their ranking.
5. **Colourways** are dealt by the same score, apart by family within an
   outfit.
6. **The cheer** is the outfit's.
7. **Year-dated seasons** are worn: the day the deal reads carries its year.

## Plan

- [x] `looks.ts`: items (outfits or pieces) per theme, the free-slot season
      rule, silhouette and family apart, the year in the day
- [x] The roster: the workspace's Cells in view, in the order they came,
      dealt together and kept (`tabs/roster.ts`), read by `CellMark`
- [x] Fixtures: today's deal unchanged for the original's packs where the
      rules agree; tests for each rule
- [x] The keyline on the app's light theme (`paint.ts`): its own PR, #59
- [x] Proof: a crew of twelve rendered with `cells crew` on both frames

## Review

- The deal (`cell/looks.ts`) walks items, not pieces: a pack's outfits, else
  its pieces. One ranking per Cell and theme, as before; outfits are kept
  apart by silhouette and family, then by least worn; pieces by least worn,
  so the original's packs deal as they did out of season.
- First built as "seasons add" (the theme's item first, the season's in
  the slots left free). The drawn season packs showed what that costs:
  their outfits all wear a hat, so in a house crew of twelve only 3 Cells
  wore November and 9 of 12 August Cells wore the one hatless outfit. Now
  the season is dealt first: every Cell wears the season, its outfits
  spread apart, and the theme's piece shows in the slots left free. For
  the original's seasons the season pieces dealt are the original's own.
- `Look` keeps only `worn`: every item is dealt into free slots, so what a
  Cell is dealt is what it wears.
- The roster lives in `tabs/roster.ts` beside the workspace it reads, and
  `CellMark` passes its look to `CellFigure`; Cells outside the workspace
  are still dealt alone. No upstream file changes.
- Proof: `cells crew` sheets for 2027-03-10 (twelve house pieces, all
  different), 2026-10-21 (Halloween first, house pieces in the free
  slots), and, with the drawn packs copied in, 2026-08-15 and 2026-11-15.
  In the dev app, seven new Cells in the tab strip wore seven different
  house pieces with Halloween's beside them (under "seasons add").
- The keyline on the app's light theme: its own PR, #59.
- From the pack agents: the deal fixture is the kit's deal again (drawn
  packs' seasons held 08-15 and 11-02), and a back piece that rises above
  the crown is fitted like a hat. With the five drawn packs on their
  branches copied in, the suite passed and `cells check` found no failures.
