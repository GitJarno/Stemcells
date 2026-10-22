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

## The flight (Windows W7c)

The carry engine's half: a carried Cell let go with speed flies, and the
Cell draws the flight's facts with the half above. A port of the
original's thrown soft Cell (the original app's `MochiToss.swift` in its
`MochiWorld.swift`), its hand (`CritterToss.swift`'s velocity) and its
hit judgement (`CritterBonk.swift`), driven as `CritterTossView.swift`
drives it.

- [x] `windows/throwWorld.ts`: the world for one body, its fixed frames
      and the glide between them, the arena's sides, top and floor.
- [x] `windows/throw.ts`: the hand's speed, the release rule, the hits
      and the word, the dizzy beat, the walk home, `Toss` for the Cell,
      the catch mid-air.
- [x] Tests against golden flights from the Swift original itself
      (`stemcells/scripts/throw-golden.swift`): paths, contacts, words,
      the dizzy beat and the way home at 120 Hz and 60 Hz, a catch
      mid-air, the hand; bounces, friction and the roll; the same landing
      at 60 Hz, 120 Hz and under load; the release rule.
- [x] `windows/CellThrow.tsx`: the thrown Cell in a layer over the
      window's content, moved by transform alone, its words under it, its
      place empty while it is away; caught again mid-air; Esc home;
      unmounted once home. The carry (`ChatCarry.tsx`) hands it over.
- [x] Proved in the lab: a flick into a wall, a lob onto the floor, a
      high throw to the top, a gentle plop, Reduce Motion; dropped
      frames at 120 Hz.
- [x] The walk home takes 3 s at most (decided 2026-10-21): a short way
      at `HOME_PACE`, a longer one quickened to fit, the scoot's beat
      quickened with it (`Toss.walking.rate`) so each step covers the
      same ground. Proved: home within 3.2 s from the far side of floors
      760, 1800 and 3000 px wide.

### Review

The lab's own window at 120 Hz, a lab chat, input over CDP with each
event's time. Frames from the let-go until the Cell is home, with no
screencast: wall 1126 (0 dropped, worst 9.4 ms), lob 1384 (0), top 724
(0), plop 590 (0), caught mid-air and thrown again 506 (0); no long
tasks. With the screencast on, one frame dropped in the lob (15.9 ms).
The Cell is in the air one frame after the let-go is handled. Reduce
Motion throws nothing: the card fades and the Cell is home in 239 ms.
Esc sends it home in about half a second.

The walk home took 9.3 s after the wall flick and 11.5 s after the lob,
so it now takes 3 s at most. In the lab, the wall flick's walk took 3.01 s
in the 1200 px window and in a 1728 px one (the display's width), at 3.3
times the pace there. Frame by frame its scoot runs in order, each pose
held about 50 ms: a scurry, so no hop was needed. That throw, home 5.7 s
after the let-go, drew 686 frames at 120 Hz with none dropped.

Decided (2026-10-21): the arena stays the window's content, more room to
throw (changed 2026-10-23: the arena is the Cell's own pane, and only a
let-go inside it throws; `chat-carry-polish.md`); a toss is a let-go faster than the original's lightest hit (100
px/s), as Swift's release goes by place; no haptics. Named W7c, as
`windows.md` already has a W9 for displays.

### After review (#198)

- [x] A fast let-go over a tab sprung open on the way drops the chat on
      its pane: the throw belongs to the chat's own tab (`letGoOf`'s
      `ownTab`). Lab: the chip lit, its tab opened, a let-go at well over
      1000 px/s over its pane put the chat there beside the other; nothing
      flew.
- [x] Esc is a flight's only when it is no one else's: one listener for
      every Cell still in the air (not dizzy or down for good), deciding
      once every handler has had the key. A carry takes Esc first; so do
      a focused field and any open layer, by upstream's own rule
      (`upstream/layers.ts`, held to `RightPanelTabs.tsx` by its contract
      test), so a closed popover kept on the page doesn't count; and so
      does any handler that marks it handled, find closing say. The
      composer's editor marks every Esc handled (ProseMirror's
      `captureKeyDown`), so its own mark is no claim. Lab, with a closed
      popover on the page: the composer focused, Esc sent the Cell home;
      find open, Esc closed find and the Cell flew on; find open and the
      composer focused, upstream's find left the key and the Cell went
      home; the composer's `/` menu open, Esc closed the menu and the
      Cell flew on.
- [x] Leaving the page mid-flight puts the Cell home (the flight ends on
      unmount, after React's development remount); a Cell that fails to
      draw is home too (`HomeOnError`). Lab: away to Settings and back,
      the Cell was home and no flight resumed.
- [x] A cancelled press or a lost hand sets the Cell down where it hangs
      (`setDown`). Lab: held by touch, moved fast, the touch cancelled: it
      fell straight down.
- [x] One frame loop per flying Cell: the flight steps (its place
      measured first), moves the box, then `CellToss` draws. Lab: 121
      flight frames and none of `CellToss`'s own over a second at 120 Hz;
      wall 687, lob 792 and top 659 frames from let-go to home, none
      dropped.
- [x] The landing wait before the dizzy beat: the original's applies
      only to a critter without a look, whose landing squash the view
      draws (CritterTossView.swift:240); a Cell's world squashes it. The
      golden script now runs that guard, and the flights it writes are
      unchanged (without a look, two of them would wait).
- [x] Tests: the sprung tab, `setDown` and the flight proper (unit);
      Esc past a closed popover, from the composer's text, left to a
      field and an open layer, one thing per Esc with find open, and the
      page going (browser, `CellThrow.browser.test.tsx`); the open-layer
      rule against upstream's (`layers.contract.test.ts`).
