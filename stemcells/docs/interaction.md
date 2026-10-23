# Interaction

How things move when the person moves them, or when work arrives: one
vocabulary of motion across the app. Durations and springs are the motion
tokens in `apps/web/src/stemcells/tokens/stemcells.css`; nothing names a
time of its own.

## The spawn

Words become Cells: they pour into Aski, Aski divides into a small copy
of itself for each Cell, and each copy flies to where its Cell stands and
condenses into it. Three owners play one sequence: the words (`words/`),
Aski and its copies (`aski/`), and the Cell forming (`cell/`).

| Beat   | What moves                                                                                                                                                                                                                           | Owner       | Timing                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| In     | Aski fades in and looks down at the composer; the sent words leave as letters and pour into Aski                                                                                                                                     | Aski, words | Aski on `fade`; letters `letter-stagger` apart, all within `letters-span`, each on `travel`                        |
| Around | The letters orbit Aski while it plans, its eyes riding the orbit; the panes open                                                                                                                                                     | words, Aski | one `orbit-turn` at least, clockwise from the top; panes on `settle`                                               |
| Out    | Aski divides: a copy buds out of it for each Cell, nearest first, and flies to the Cell's box, or to its tab's chip when the Cell landed off stage; Aski pulses once a copy (a row's squash, sprung back), its eyes on where it goes | Aski        | the first copy at once; copies `spawn-stagger` apart, at most 4 in flight, each on `travel`; each pulse on `flick` |
| Glyphs | Over the Cell's box, the copy condenses: `. : + # @`                                                                                                                                                                                 | words       | one glyph a `form-step`                                                                                            |
| Blocks | The glyphs become the Cell's outline in blocks: `░ ▒ ▓ █`                                                                                                                                                                            | Cell        | one block a `form-step`                                                                                            |
| Hop    | The Cell's own pixels, a crouch, and a hop onto its line                                                                                                                                                                             | Cell        | four `form-step`s, then its mood                                                                                   |

- **One Cell from a draft** plays only the last three beats, in its own
  pane, starting on Enter. Aski stands over a new chat's headline, where
  the spawn's Aski stands (`aski/AskiStanding.tsx`): with one Cell, Aski
  flies to the line whole and becomes the Cell; with several, the spawn's
  Aski takes its place.
- **A copy into a chip** shrinks away there: the Cell stands in its pane
  when the person goes to it.
- **From Aski's room**, each Cell Aski launches gets a copy from Aski to
  its tab's chip as it lands (`aski/copies.ts`). Aski's tab holds Aski
  alone, so the chip is where the person sees it went.
- **The hand-off** is one call, `formAt(threadId, at)` (`cell/forming.ts`),
  with `at` a `performance.now()` time: before `at` the Cell's box is the
  copy's, and from `at` the Cell plays its blocks and its hop. Call it as
  soon as the thread is known (a draft's, on Enter, as its line appears); a
  Cell already standing leaves its box until `at`. `cellBoxOf(threadId)` is
  where the box stands on the pane's composer line (null until it is
  drawn), for the glyphs to condense into; the blocks then fill the Cell's
  own outline in its body's colour.
- **Nothing waits on it.** The composer takes typing from the first frame,
  and the Cell's first message shows as it comes. A call that never comes
  leaves the Cell standing, and a hand-off is held to 3 s ahead at most, so
  the box is never empty longer.
- **Aski** is otherwise still. After the last copy its eyes go `^ ^`,
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

- **In the hand**: a chat taken by its Cell hangs the Cell itself from
  the hand, held; its place on the composer's line stands empty until it
  is back. (Taken by the grip at its pane's top, a card of the chat is in
  the hand instead, and nothing is ever thrown.)
- **Letting go** with the hand inside its own pane, the Cell is thrown as
  fast as the hand went (its speed scaled by 0.55): a slow let-go sets it
  down, to land and walk home. Anywhere else nothing is thrown: over
  another pane, a chip, or a tab sprung open on the way, the chat drops
  there and the Cell goes home to its line in the chat's new place, or
  into the chip; elsewhere it goes home.
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
- **Reduce Motion:** nothing is thrown. Let go in its own pane, the Cell
  fades where it is and is home, as any carry let go elsewhere.
