# The swipe between tabs under load

The person: with many tabs and a busy Mac, the two-finger swipe between tabs
"overshoots, undershoots, and lags", and "especially if the next tab has
only one chat, it often skips over it. It goes there and then over it to the
next one."

The bar, under the load case: no wrong turns, the strip under the fingers
within a frame or two at p95, no runs of dropped frames while it is dragged
or settles. One continuous contact of the fingers turns at most one page; a
second page takes a second touch.

## The rig

`stemcells/lab/swipe/` drives the desktop lab app (`stemcells/lab/electron
dev`, window off every screen, every provider a fake, chats on the free
Replay agent).

- `inject.m` + `inject.cjs`: a Node-API addon loaded into the lab app's own
  main process posts phased trackpad scroll events into the app's event
  queue, so nothing reaches the system's event stream and no permission is
  needed. A stream's header says whether the scroll-phases addon hears it:
  without, the page gets the wheel events alone, as a browser does.
- `streams.mjs`: a swipe as the trackpad sends it: fingers at 120 Hz, then
  a coast at 60 Hz that decays.
- `run.mjs`: the cases, 30 swipes each, counting the pages each swipe
  turned against the pages it should have. `--throttle` slows the page's CPU
  through the DevTools protocol, `--hold` blocks its main thread on a beat,
  `--phases 0` drops the phases, `--trace` records the pictures drawn.
- `analyze.py`: reads the strip's place from a coloured bar on each page in
  the trace's pictures: delay from a finger's move to the strip showing it,
  gaps in the pictures while it moves, distance past its target.
- `matrix.sh`: the whole table for one phase, the Mac's load average beside
  each run.
- `e1.mjs`, `e2.mjs`: the two experiments the design rests on (below).

The lab: 15 tabs holding 2, 1, 3, 1, 2, 1, 2, 1, 1 … panes (tab 1 is the
one-chat tab between two tabs of several), 20 chats of 11 Replay turns each.
The load case: 12 chats streaming, the page's CPU throttled 2×, and its main
thread held 120 ms in every 500. The lab runs the web's dev build, which
renders slower than a built one.

The cases: `single` an ordinary swipe (300 px, then a coast); `onechat` the
same, onto the one-chat tab from either neighbour; `quick2` two swipes
160 ms apart (two pages); `short` 60 px and a coast; `hard` 1100 px (one
page); `slow` a drag let go with no coast.

## Before

The pager as it was (`6d21a35944`). Other work kept the Mac's load average
between 10 and 60 throughout, which is the person's own condition.

Page quiet, 30 swipes a case:

| Case               | Wrong | What went wrong           | Load |
| ------------------ | ----- | ------------------------- | ---- |
| single             | 2     | turned two pages          | 40.8 |
| onechat            | 0     |                           | 40.0 |
| onechat, no phases | 2     | did not turn              | 20.9 |
| quick2             | 7     | the second swipe was lost | 26.1 |
| short              | 0     |                           | 13.7 |
| hard               | 0     |                           | 10.9 |
| slow               | 0     |                           | 10.8 |

Quiet, traced (12 swipes): finger to strip 20 ms median, 74 ms p95, 82 ms
worst; first move shown 42 ms after it was due (median), 60 ms p95.

Under load: to be measured back to back with the new strip.

An earlier, informal run with all 20 chats streaming: 2 of 12 ordinary
swipes turned two pages.

## What the traces showed

- **The main thread is in the path of every frame.** The strip moved by a
  transform written from a wheel handler. With six chats streaming, long
  frames took 40% of the time (median 90 ms, worst 180 ms); with the CPU
  throttled 2×, 66% (median 228 ms, worst 611 ms). Wheel events reached the
  page 50–165 ms late in those frames; the strip stood still for 117–200 ms
  with the fingers moving, and let go 77 ms after they lifted. In one swipe
  it did not move until the fingers were gone.
- **The skip.** Traced in a swipe that turned two pages: the lift arrived
  on time and the strip let go; the turn's own render then held the main
  thread 328 ms. The coast's wheel events arrived after it, merged, more
  than 250 ms past the latest phases, so they fell through to the reading
  from wheel events alone, which took them for fingers. The rule that a
  second quick swipe goes one page further then turned a second page. The
  rule is right; what fed it was a guess. A second case began with the main
  thread held at touch-down and the lift's phases 84 ms late.
- **Why a one-chat tab.** Not yet separated from the above in a trace; to
  be compared under load.
- **The first event waits.** A wheel listener that may cancel makes the
  compositor ask the main thread before it scrolls anything under it. The
  pager's was one; the composer's is another, over every pane.
- **Upstream's history swipe** (`components/HistorySwipeNavigation.tsx`)
  hears the same swipes on the desktop and goes back or forward in history
  at 120 px unless something under the pointer scrolls sideways. The pager
  was not a scroller, so it did not count. Not yet shown to turn a page in
  the lab (its routes replace, so there was no history to go to).

## The design

Motion that needs the main thread every frame cannot meet the bar, whatever
the handler does. Only a native scroll follows the fingers on the
compositor, and only where no cancelling wheel listener lies over it.

- The pager's viewport becomes a native sideways scroller with snap points:
  a **proxy**. It holds a wide track of snap slots and nothing else that
  moves. The pages sit in a box that sticks to the viewport, and that box
  follows the proxy's scroll through one scroll-linked animation
  (`ScrollTimeline`) whose keyframes are **knots**: proxy slot → page
  offset. Fingers, coast and snap all run on the compositor.
- **Walls.** The knots are flat past one page either side of where a touch
  began, so one touch shows at most one page further however far the proxy
  goes. The compositor holds the rule; no event can break it by being late.
- **Ends.** Past the first or last page the knots rise a little and come
  back: the strip gives and returns, on the compositor too.
- **Touches**, where the desktop app's scroll phases say so exactly: a touch
  that begins while the strip is in flight moves the walls to the page it
  is headed for, and if it is flicked on the way there it is owed a page:
  the strip takes it by a spring while the proxy lands. Late phases only
  delay this. Without phases (a browser) the walls move when the proxy
  rests, so a second swipe counts once the first has landed.
- **At rest** the offset folds into the strip's own place and the proxy
  goes back to the middle of its track, in one commit.
- **Turns by a click or a key** slide the strip by a spring, as before; a
  far one still comes in as the next page.

### What changes in the feel, and why

- **Letting go.** Was: by distance alone, past 110 px the next page.
  Now: the platform's own rule: flicked, the next page in the flick's way,
  however short; let go at rest, the nearer page. A rule that sends the
  strip back against its coast needs the main thread at the instant of the
  lift, which is the thing that fails under load: the strip would ride the
  coast the wrong way until the page caught up.
- **The settle** is the browser's snap, not our `page` spring. Turns by
  click and key keep the spring.

### What lost

- **A faster wheel handler** (less work a frame, `isInputPending`, phases
  matched more loosely): the events still arrive late; this is what the
  pager already did.
- **Native scroll-snap alone** (experiment 1): a hard swipe turns two
  pages; a second quick swipe adds nothing unless it carries the strip past
  the page it was landing on; the pages cannot be re-based mid-flight.
- **Pointer or touch events**: a trackpad's two-finger scroll sends neither.

### The experiments

1. `e1.mjs`, a bare native snap pager in the lab page: with the main thread
   held 700 ms it follows the fingers within about 11 ms, once no cancelling
   wheel listener lies under it. Its rules as measured: any flick turns,
   even 20 px; let go at rest it goes to the nearer page; 1100 px turns two
   pages; two swipes 160 ms apart turn one.
2. `e2.mjs`, the proxy: the walls hold a hard swipe to one page; the end
   gives and returns; a sideways scroller inside a page keeps its own
   swipes and a list its vertical ones; the knots change mid-flight without
   a jump; a spring on the strip adds to the proxy's motion smoothly; a
   cancelling listener elsewhere on the page costs nothing.

## Plan

- [x] The rig, the lab's load case, the quiet baseline
- [ ] The baseline under load, and a swipe onto a one-chat tab against one
      onto a many-pane tab
- [ ] The knots, as pure functions with tests
- [ ] The strip on the proxy: tabs, then the column's stages
- [ ] The browser's view rides the proxy (`surfaces/ride.ts`)
- [ ] The composer's wheel listener no longer cancels
- [ ] Delete the gesture reading the strip no longer uses, with its tests
      and recordings
- [ ] The same table after, back to back with before
- [ ] What else rides on the strip: click and key turns, the new Cell's
      swipe, settle swipes, a sideways swipe in a code block and in the
      terminal, no phases, narrow panes, the column's stages
- [ ] Video before and after, under load

## After

To come.
