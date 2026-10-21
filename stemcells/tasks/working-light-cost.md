# A working Cell's light costs a few frames a second, not every frame

Three Claude Cells working in the installed app kept the GPU helper at about
35% CPU and the renderer at about 32%. The light a working Cell wears
(`glow/`) drew a new frame on every refresh of a 120 Hz display for as long
as any Cell worked: the wash's drift and the needs-you breath never rest, and
a shining label's endless background animation woke the page's main thread
on every frame, for the whole beat, though it moved only while the crest
crossed it.

## Plan

- [x] Measure in the desktop lab (`stemcells/lab/electron`, a fake `claude`
      that streams for an hour): GPU helper and renderer CPU for 1 and 3
      Cells, idle and working, each of our loops turned off in turn
- [x] The drift and the breath step on the Cells' sprite clock (`form-step`,
      12 a second), on the same wall clock, period and curve
- [x] A shining label animates only while the crest crosses it; through the
      rest of the beat nothing runs for it
- [x] The light holds while no one can see it: the window hidden,
      minimised or covered, or the surface off screen (the tab pager keeps
      its neighbours mounted off screen); it rejoins the beat where the beat
      is
- [x] In a window that shows while another app has the focus, the light
      keeps moving, every part of it stepped on the sprite clock, the crest
      included, on the same period and phase
- [x] Before and after numbers in each pull request

## Decisions

- The crest's crossing stays smooth at the display's rate: it is the one
  motion the eye follows, and it rests a quarter of every beat. What changes
  is what never rests (stepped twelve times a second, below what a slow
  cross-fade shows) and what ran without moving (a label's held frames).
- Held is the beat's rest: the band off the glass, the wash at its near end,
  the labels in upstream's ink. Reduced motion holds as before.
- A window beside an editor is how the app is used, and a frozen wave there
  reads as a stalled Cell (the person, 10-21). So only what no one can see holds;
  a window that shows but isn't in use steps everything twelve times a
  second, and the needs-you breath keeps pulsing. The crest glides on from
  where it is once the window is in use.

## Review

Measured in the desktop lab on the production web build: a hidden
1100×780 window at 2× drawing at 120 Hz, a fake `claude` working for an
hour per Cell (thinking, a line, a tool call, every six seconds), CPU per
process from cumulative CPU time over 45 s, each build in turn on the same
Cells. GPU helper / renderer, % of one core:

|                               | main    | + steps | + label crossings | + hold  |
| ----------------------------- | ------- | ------- | ----------------- | ------- |
| 3 Cells, focused              | 41 / 30 | 25 / 28 | 25 / 26           | 25 / 24 |
| 3 Cells, another app in front | 44 / 31 |         | 25 / 24           | 8 / 16  |
| 1 Cell, focused               | 24 / 19 | 14 / 17 | 15 / 14           | 15 / 15 |
| 1 Cell, another app in front  | 24 / 19 |         | 15 / 14           | 5 / 8   |
| Nothing working               | 3 / 2   |         |                   | 3 / 2   |

"+ hold" held the light whenever the window wasn't focused. The rule that
ships holds it only where no one can see it, and steps it beside another
app. Re-measured on fresh Cells, the same way, two rounds averaged for
three Cells. "Hidden" tells the page it is hidden; a really hidden window
also stops drawing, so it costs less still:

|                             | main    | + label crossings | + hold on blur | + sight |
| --------------------------- | ------- | ----------------- | -------------- | ------- |
| 3 Cells, focused            | 37 / 26 | 24 / 23           | 25 / 23        | 24 / 22 |
| 3 Cells, beside another app | 39 / 28 | 24 / 23           | 8 / 15         | 12 / 20 |
| 3 Cells, hidden             | 40 / 28 |                   | 8 / 15         | 8 / 15  |
| 1 Cell, focused             | 24 / 19 | 15 / 13           |                | 16 / 15 |
| 1 Cell, beside another app  | 25 / 19 | 16 / 14           |                | 9 / 11  |
| 1 Cell, hidden              |         |                   |                | 5 / 8   |

- What it cost, three Cells on main, each loop off in turn: the drift
  ~17 points of GPU; the crest (band, sheen, overlays) ~10–15 GPU and a few
  of renderer; the labels' endless animation 4–10 renderer, growing with
  the chat (every frame's main-thread pass walks a longer page); the veil's
  blur 2–4 GPU while something moves over it.
- Upstream's share: three Cells streaming with none of our loops cost
  ~6% GPU and ~16% renderer (with a 12 a second sprite each); upstream's
  own stepped label shine would add ~6 renderer. One Cell on screen with
  three more working in the next tab costs ~20% renderer with no loops at
  all: the pager keeps the neighbour's chats mounted, and they render as
  they stream. Not touched here.
- A trace of one focused Cell: main-thread frames 113 → 42 a second, GPU
  swaps 120 → 76 (the crest's pass).
- Left: the crest at the display's rate. Stepping it at 60 Hz saved ~4
  points of GPU in the lab, not worth a visible change to the one motion
  the eye follows.
