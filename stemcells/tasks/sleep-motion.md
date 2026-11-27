# The lists' motion

Every row movement in the Cells' lists, on the phone and the Mac, goes through
one system: a reorder by time, a pin and an unpin, Sleep, Wake, a new Cell, a
row removed. No one-off effects. Before this, a slept row on the phone just
left, a reordered row jumped, and the Mac's column had a hop and nothing else.

## Decision

**One motion, three primitives, and Sleep's leap.** The spec is one plain
module both apps read, `apps/web/src/stemcells/motion/listMotion.ts` (the
phone through `line/kit.ts`), each timing a token of `tokens/stemcells.css`;
the leap's physics, which no curve can hold, sit beside them there:

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
  fly at once; the rest only tick. A slept Cell leaps instead (below).
- **Leap**: Sleep's leave, wherever it starts (a swipe, a menu, the Mac's keys
  or buttons). Putting a Cell to sleep is always a job done, so its Cell
  doesn't fly: it leaps from where it stands into Asleep's count, and Asleep
  catches it. Physics, not a tween (`leapOf`, `leapAt` in `listMotion.ts`):
  - a crouch, 90 ms, ease in-out: it squashes 12% on its feet;
  - up, one gravity (6400 pt/s²) slowing it to its top, which stands 1.6 of
    its heights plus 5% of the way over the higher end (90 at most); it leans
    6° into the leap and stretches 14% at launch, round at the top;
  - its eyes close 40 ms past the top;
  - down under the same gravity, faster and faster, stretching to 18%, lying
    back 14°, shrinking to the count's words and going into them over its
    last word's height. Up and down are one parabola: the time up is to the time
    down as √rise is to √fall. Its time in the air is what gravity says,
    held between 380 and 560 ms, so it lands 470 to 650 ms after the crouch
    began.
- **Catch**: Asleep gives under the landing, 80 ms easing out, then a soft
  spring hands it back past its place and to rest (`--sc-motion-catch`,
  response 0.36, damping 0.5; about 0.16 rebound, still by 625 ms): the
  phone's pill dips 3 pt, widening 2% and flattening 5%; the Mac's Asleep
  row dips 2.5 px. A second landing gives again from wherever the first has
  it. The count ticks as it lands; on the phone a light haptic as the feet
  leave the ground and a soft one at the catch. Wake keeps the flight.

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
- The leap: both apps sample `leapFrames` from the one spec, about every
  16 ms. The phone carries the poses to the UI thread whole and runs them on
  a linear clock (`home/Hop.tsx`, `poseAt` in `home/flight.ts`); the eyes
  close from an animated reaction at the pose's moment. The Mac plays them as
  one linear WAAPI animation, open-eyed then shut-eyed (`rail/Hops.tsx`).
  The Mac leaps as the person presses Sleep, from the row as it folds (a
  settle can take seconds while a Cell at work stops); the phone's Cell waits
  over its row for the line, as before. A Cell moved again mid-air starts a
  new flight.

## Plan

- [x] The spec, held to the tokens
- [x] Phone: move (T3's list), enter, leave with the flight, count tick
- [x] Mac: move (rows glide), enter, leave on the move's timing, the hop's curve
- [x] Pins as moves on the phone
- [x] Reduce Motion
- [ ] Gates, pull request, merge, seen on the Duo, an iPhone and the Mac
- [x] Sleep's leap and Asleep's catch, phone and Mac
- [ ] The leap seen on an iPhone and the Duo

## Review

- Not seen on a device yet: the phone's flight, its pin glide (relies on
  LegendList animating a row that changed place) and the pill's bump.
- The sidebar's asleep rows (the unfolded Duo) draw no Cell, so a Wake there
  doesn't fly; its row leaves and the count ticks.
- The Mac's asleep rows bloom in the accent: they carry no provider tone.
- The leap: seen on the Mac in a headless lab, frame by frame and in real
  time. The phone's leap, its haptics and the pill's catch are not yet seen
  on a device. On the Mac a settle that fails brings its row back after its
  Cell has leapt.
