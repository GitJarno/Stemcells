# The lists' motion

Every row movement in the Cells' lists, on the phone and the Mac, goes through
one system: a reorder by time, a pin and an unpin, Sleep, Wake, a new Cell, a
row removed. No one-off effects. Before this, a slept row on the phone just
left, a reordered row jumped, and the Mac's column had a hop and nothing else.

## Decision

**One motion, three primitives.** The spec is one plain module both apps read,
`apps/web/src/stemcells/motion/listMotion.ts` (the phone through
`line/kit.ts`), each number a token of `tokens/stemcells.css`:

- **Move**: a row glides from its old slot to its new one, on
  `--sc-motion-recede` (350 ms, an ease out, no overshoot). Reorders by time,
  pins and unpins are plain moves.
- **Enter**: a row new to a stage fades in where it landed (`--sc-motion-fade`,
  200 ms) the first time the person sees that stage, then its light blooms
  once and rests at its state's level (250 ms up, 650 ms down). Nothing
  scrolls the person to it. More than four entering at once is the list read
  again (a pick, a page), and none enter.
- **Leave**: a row folds away while the rest move up, on the move's timing.
  Sleep and Wake are a leave whose Cell lifts out of the row and flies, on the
  move's curve and a low bow, to the other stage's count, shrinking to its
  words; the count holds it until it lands, then ticks with one small bump
  (`--sc-motion-settle`'s length) and a light haptic on the phone. At most four
  fly at once; the rest only tick.

Every motion runs once on the UI thread (the phone) or as one animation (the
Mac), and ends; nothing is mounted or repaints while still. With Reduce
Motion nothing moves, fades or flies: rows stand in their places, counts
change, and an entering row's light still blooms.

## How each platform runs it

- Phone: T3's list moves its rows with its item layout transition, given the
  move's timing (`upstream/substitutes/threadListAnimations.ts`); a pin no
  longer dismisses its row (`home/pins.ts`, a seam). The Cell's flight starts
  at T3's dismissal (`home/useDeparture.ts`, `home/hops.ts`, drawn in
  `home/Hop.tsx` over `CopyLayer`); entrances come from each reading of the
  line (`home/useLineMotion.ts`, `home/Arrival.tsx`).
- Mac: `rail/rowMotion.ts` glides each stage's rows from their last places
  and enters new ones (`--cells-bloom` in `cells.css`); the fold is CSS on the
  move's timing; `rail/Hops.tsx` flies on the move's curve.

## Plan

- [x] The spec, held to the tokens
- [x] Phone: move (T3's list), enter, leave with the flight, count tick
- [x] Mac: move (rows glide), enter, leave on the move's timing, the hop's curve
- [x] Pins as moves on the phone
- [x] Reduce Motion
- [ ] Gates, pull request, merge, seen on the Duo, an iPhone and the Mac

## Review

- Not seen on a device yet: the phone's flight, its pin glide (relies on
  LegendList animating a row that changed place) and the pill's bump.
- The sidebar's asleep rows (the unfolded Duo) draw no Cell, so a Wake there
  doesn't fly; its row leaves and the count ticks.
- The Mac's asleep rows bloom in the accent: they carry no provider tone.
