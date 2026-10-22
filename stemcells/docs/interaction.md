# Interaction

How things move when the person moves them, or when work arrives: one
vocabulary of motion across the app. Durations and springs are the motion
tokens in `apps/web/src/stemcells/tokens/stemcells.css`; nothing names a
time of its own.

## The spawn

Words become Cells: they pour into Aski, Aski sends one stream to each
Cell's pane, and in each pane the stream condenses into the Cell. Three
owners play one sequence: the words and the streams (`words/`), Aski
(`aski/`), and the Cell forming (`cell/`).

| Beat   | What moves                                                                                                                       | Owner       | Timing                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| In     | Aski fades in and looks down at the composer; the sent words leave as letters and pour into Aski                                 | Aski, words | Aski on `fade`; letters `letter-stagger` apart, all within `letters-span`, each on `travel`                           |
| Around | The letters orbit Aski while it plans, its eyes riding the orbit; the panes open                                                 | words, Aski | one `orbit-turn` at least, clockwise from the top; panes on `settle`                                                  |
| Out    | Aski sends one stream to each pane, nearest first, and pulses once a stream (a row's squash, sprung back), its eyes on that pane | Aski, words | the first stream at once; streams `spawn-stagger` apart, at most 4 in flight, each on `travel`; each pulse on `flick` |
| Glyphs | In the pane, the stream condenses over the Cell's box: `. : + # @`                                                               | words       | one glyph a `form-step`                                                                                               |
| Blocks | The glyphs become the Cell's outline in blocks: `░ ▒ ▓ █`                                                                        | Cell        | one block a `form-step`                                                                                               |
| Hop    | The Cell's own pixels, a crouch, and a hop onto its line                                                                         | Cell        | four `form-step`s, then its mood                                                                                      |

- **One Cell from a draft** plays only the last three beats, in its own
  pane, starting on Enter.
- **The hand-off** is one call, `formAt(threadId, at)` (`cell/forming.ts`),
  with `at` a `performance.now()` time: before `at` the Cell's box is the
  stream's, and from `at` the Cell plays its blocks and its hop. Call it as
  soon as the thread is known (a draft's, on Enter, as its line appears); a
  Cell already standing leaves its box until `at`. `cellBoxOf(threadId)` is
  where the box stands on the pane's composer line (null until it is
  drawn), for the glyphs to condense into; the blocks then fill the Cell's
  own outline in its body's colour.
- **Nothing waits on it.** The composer takes typing from the first frame,
  and the Cell's first message shows as it comes. A call that never comes
  leaves the Cell standing, and a hand-off is held to 3 s ahead at most, so
  the box is never empty longer.
- **Aski** is otherwise still. After the last stream its eyes go `^ ^`,
  and once the spawn is done it fades out on `fade`.
- **Reduce Motion** plays none of it: Aski doesn't appear, the panes
  appear and each Cell stands.
- `form-step` is one beat of the sprite clock (12 a second), so the glyphs,
  the blocks and the Cell's own frames keep one rhythm.

## The toss

A carried Cell let go with speed is thrown: it flies, bonks off its
chat's sides and top, lands on its line, and goes home. Two owners: the
carry engine moves it and judges its hits (`windows/throw.ts`, its world
`windows/throwWorld.ts`); the Cell draws it (`cell/toss.ts`). It flies as
the original's soft Cell: it never tumbles, an off-centre throw rolls its
face round, its body is springs a hit sets going, and its face is what the
body goes through.

- **Letting go** of a carried chat with the hand inside its own pane: at
  100 CSS px a second or faster (after the hand's speed is scaled by
  0.55), its Cell is thrown; slower, it goes home. Anywhere else nothing
  is thrown: over another pane, a chip, or a tab sprung open on the way,
  the chat drops there however fast it is let go; elsewhere it goes home.
  Thrown, the card goes, the chat shows where it was, and the Cell flies
  from the hand; its place on the composer's line stands empty until it
  is back.
- **The flight** is the original's, model and numbers: the hand's speed
  over its last 0.12 s, cut to 1100 CSS px a second; a fall of 1400 CSS
  px a second²; a wall gives back 0.35, the top 0.38, the floor less the
  harder it lands, and a slide brakes on its grip. The world steps whole
  frames and the Cell glides between them, so a throw lands in the same
  place at 60 Hz, at 120 Hz and under load. Its arena is its chat's pane,
  from its top down to the line the Cell stands on at home: it never
  leaves its chat, caught and held included. All
  of it is in CSS px, so under the page's zoom the Cell, its world and the
  hand scale together, as the original's critter did at its scale.
- **Caught** mid-air, down or on its way home, it hangs from the hand and
  is thrown again as fast as the hand lets go: a new flight. A press that
  is cancelled, or a hand lost, sets it down where it hangs, not thrown.
- **Esc** sends every Cell still in the air (not yet dizzy or down for
  good) straight home on `land`, when it is no one else's: a carry takes
  Esc first; so do a field with focus, and any layer open (upstream's own
  rule, `upstream/layers.ts`: a closed popover kept on the page doesn't
  count); and so does whoever marks it handled, find closing say. The
  composer's editor marks every Esc handled, so its mark is no claim. One
  Esc does one thing. Another tab on stage, its place gone, or its page
  left, and it is home at once.
- **The handshake** is the flight's facts each frame: `Toss` (held, its
  velocity, grounded, the roll, the flight's hits, its dizzy beat, its
  walk home). The flight runs the frame, one loop for both: it steps,
  moves the box, then `CellToss` draws the live Cell from the facts.
  `tossFrame(look, toss, now)` is the same as a pure function, and
  `BonkWord` says the word.
- **Held** hangs stretched, braced `> <` with an `o`. **In the air** it
  stretches along its speed and leans into it, the hat trailing: `^ ^`
  going up, `> <` and `o` coming down. **A wall** flattens it the other
  way and throws its crown off it; **the top** presses it down; **a
  landing** pancakes and rebounds. A hit braces its face; **sliding** it
  grins, tipped over its braking.
- **"BONK!"** on a real hit only, one word under the Cell, in from the
  edge it hit and clear of the body: it lands a touch large on `beat`,
  stands `knock-stand`, fades on `recede`. A tap says nothing; a wham is a
  touch larger and bolder.
- **Dizzy**, only after a big flight (one wham, or two bonks): `x x` and a
  wavy mouth for `dizzy`, three stars circling its head. Once it is down
  and its words have faded it stands `bearings` and **walks home** in its
  scoot, facing home, four box widths a second; a longer way than 3 s at
  that pace quickens it, the scoot's beat with it, so no walk home takes
  longer. Home, nothing of the flight runs.
- **Reduce Motion:** nothing is thrown. Let go fast, the card fades where
  it is and the chat is home, as any carry let go elsewhere.
