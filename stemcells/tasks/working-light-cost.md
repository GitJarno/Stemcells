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
- [ ] The light holds while no one can see it: the window hidden or not
      focused, or the surface off screen (the tab pager keeps its neighbours
      mounted off screen); it rejoins the beat where the beat is
- [x] Before and after numbers in each pull request

## Decisions

- The crest's crossing stays smooth at the display's rate: it is the one
  motion the eye follows, and it rests a quarter of every beat. What changes
  is what never rests (stepped twelve times a second, below what a slow
  cross-fade shows) and what ran without moving (a label's held frames).
- Held is the beat's rest: the band off the glass, the wash at its near end,
  the labels in upstream's ink. Reduced motion holds as before.

## Review

(numbers per pull request)
