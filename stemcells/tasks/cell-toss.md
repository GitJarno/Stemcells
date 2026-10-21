# A thrown Cell

Carrying a chat (`windows.md`, W7) lets the person throw its Cell: it flies,
hits the window's sides, lands, and goes home. This is the drawn half: how
the Cell looks at each moment and the word a real hit says. The carry
engine owns the flight: where the Cell is, how fast, when a hit counts and
how hard, when a flight earns a dizzy beat, and when the walk home starts.
It tells the Cell those facts; the Cell draws them.

A port of the original's thrown Cell, which flies as a soft body in a
world of its own: it never tumbles (an off-centre throw rolls its face
round), its body is springs a hit sets going, and its face is what its
body is going through.

## What it draws

| State        | The Cell                                                                       | From the original            |
| ------------ | ------------------------------------------------------------------------------ | ---------------------------- |
| Held         | stretched as it hangs (1.08), `> <` and `o`                                    | the toss in the hand         |
| Rising       | stretched along its speed, leaning with it, `^ ^` and a smile                  | the world's flight and faces |
| Falling      | the same, `> <` and `o`                                                        | the same                     |
| Wall bonk    | flattened the other way, the crown thrown off the wall, the hat lagging; `> <` | the world's wall hit         |
| Ceiling bonk | pressed down; `> <`                                                            | the toss's ceiling           |
| Landing      | the pancake and its rebound, a lean with its skid; `> <` after a hard one      | the world's landing          |
| Sliding      | the crown tipped forward over its braking, a grin                              | the world's grip             |
| Dizzy        | `x x` and a wavy mouth, three stars round its head, 1.15 s                     | the toss's dizzy beat        |
| Walk home    | its gait, the scoot, facing home                                               | the Cell's walking frames    |

- **"BONK!"**, one plain word on a real hit: in the interface's type, a
  wham a touch larger and bolder, ringed in the page's colour, under the
  Cell, in from the edge it hit and clear of the body. It lands a touch
  large, stands, and fades where it was said. A tap says nothing.
- **Reduce Motion:** the body without its springs, the faces kept; the
  word fades in and out without its knock. The engine plays no dizzy beat
  and no walk: the Cell is home.

## Plan

- [x] `cell/toss.ts`: the facts the engine gives (`Toss`), the pose at a
      moment (`tossPose`), the frame (`tossFrame`), the stars
      (`dizzyStars`), the word's knock (`knock`) and its place
      (`wordCentre`).
- [x] `toss/walk` in `art/moves/toss.json`: the scoot, from the
      original's poses.
- [x] `CellToss`: the live Cell in flight, drawn every frame from the
      engine's facts, its stars behind it. `BonkWord`: the word.
- [x] Tokens: `knock-stand`, `dizzy`, `bearings`.
- [x] Tests: each state's face and shape, a hit's springs settling, the
      walk facing home, the stars, the word's knock and place, the frames
      inside the canvas for the hardest throw.
- [x] A lookbook strip at 2x, dark and light; the signature to the
      engine's owner.

## Review

A thrown Cell now has everything it shows, drawn from the facts the carry
engine gives it. Its body is the original world's springs, solved in
closed form from the flight's hits (no state of its own), so a frame is a
pure function of the facts and the moment. The original composed a thrown
pose on a canvas 26 cells wide with headroom above; ours composes on the
hero's 32 cells, where `fitted` keeps a hat on the canvas by easing the
stretch. A hard wall hit throws a hat past the canvas's side for a moment
in both. The scoot leans past the box as the original's gait does, so the
art check warns on it. One-handed carries keep the plain scoot: no look
holds a tool at rest. Not proven in the app yet: the engine that throws a
Cell is the carry's next step, and it calls these.
