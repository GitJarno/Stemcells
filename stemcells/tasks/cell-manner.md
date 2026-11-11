# Cell manner: moves from their first frame, six temperaments, a dressed winter

A pass over how a Cell moves and what it wears, from the design in `cell-life.md` (§1
temperament, §3 choreography, §5 wardrobe). Three things were wrong or missing:

- **A cheer never started.** A scene's frame was picked from the wall clock alone, so a
  landing's cheer began on whichever frame the clock stood at and looped until its six seconds
  ran out: no crouch before the hop, four hops where one was drawn, a cut mid-air at the end.
  A move marked `once` was played as a loop.
- **A crew moved as one.** Every Cell at rest breathed on the same frame.
- **No Cell had a manner.** The six temperaments were designed and their format read by the
  kit, but none was drawn and nothing played them.

And in the wardrobe, most of the year still dealt the original's single hats: only August,
November and Lunar New Year dressed a whole character.

## Craft rules held to

From the animation canon, as the moves here use them on a 12-beat clock:

- Volume is kept: a squash widens (the rig's `sx = 1 / sy^0.75`).
- Anticipation before action, sized to it: one frame for a small hop, three for a high one.
- Rise fast, hang, drop faster; a landing squashes and settles in one or two damped rebounds,
  never past a tenth of overshoot.
- The eyes lead: a glance or a face change comes a frame before the body, at the start or the
  end of a move, never mid-air.
- A telling pose is held three frames or more; a pose shown for one frame is a twitch.
- A hold still moves: the breath and the blink go on under `^ ^`.
- Energy goes into moments. At rest a Cell breathes, blinks and, now and then, glances.
- Judged on contact sheets at the miniature first, on both grounds.

## Plan

- [x] Read the kit, the rig, the deal, the tools and `cell-life.md`; render what is there
- [x] Moves from their first frame: an entrance (landed, on it, wake, sleep) plays once from
      the moment it begins, then the state's own scene holds; Reduce Motion holds the `tell`
- [x] Rest of its own: each Cell's breath on its own phase; frames that are the same pose are
      one frame, so a resting Cell is painted only when its pose changes
- [x] Six temperaments drawn (`art/temperaments/`), dealt for life from a Cell's name: breath,
      blink, glances, a fidget, and its own on it, landed and needs you
- [x] The phone plays the same entrances and blinks on each Cell's own cadence
- [x] `cells manner`: one sheet of every temperament's rest and beats
- [x] December and January dressed in whole outfits on the original's hats (one pack each,
      drawn in parallel); a drawn season wins a tie with the original's
- [x] Docs: `cell-art.md` (temperaments, once-moves, how a cheer ends)
- [x] Proof: sheets of every temperament and pack; the dev app, a landing watched live

## Review

Landed as planned, with these calls made on the way:

- **An entrance, not a scene.** A moment is `{ kind, since }` beside the state, played once from
  `since` and bounded by the move's own pass, so a worn piece that animates can't make it
  repeat. `cast.ts` `entering` is the one place it begins: the first picture of a Cell to see
  a moment sets when it began, and a pane or a phone row that appears mid-move joins it. A
  picture that watched a landing cheers from the top whatever the clocks say; only one that
  finds a Cell already landed trusts the landing's time.
- **Rest is generated, moments are drawn.** A temperament's rest is made from its record
  (breath, puff, glances), so the six files stay a page each; its on it, landed, needs you and
  fidget are drawn frames in `art/moves/manner.json`.
- **A fidget needs someone to see it.** One window in four, and only while the person moved
  or typed in the last minute.
- **The original is untouched.** `kit/` and its parity hashes are as they were; a Cell with no
  name, and any screen that holds a Cell still, shows what it showed.
- **The check measures marks.** A drawn move's squash widens the body past the box, as the
  original's breath does; `cells check` now subtracts the body's own reach, and skips a
  temperament's landing for a look that has a cheer of its own (it never plays).
- **December and January** are packs of whole outfits on the original's hats (six and seven,
  two colourways each, a cheer each). A drawn pack wins a tie with the original's for the
  same days.

Proved by: the Cell tests (web and the phone's), `cells check`, sheets of every temperament
and both packs on both grounds, and a landing recorded frame by frame in the dev app (on it,
thinking, the cheer once from its first frame, `^ ^` at rest).

Left for later: the miniature ignores a squash's widening and low side arms (they show at the
hero only), and a tall hat still clamps a hop.
