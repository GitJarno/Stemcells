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
  each run. `feed.sh` keeps a chat streaming; `build.sh` builds the addon.
- `e1.mjs`, `e2.mjs`: the two experiments the design rests on (below).

The lab: 15 tabs holding 2, 1, 3, 1, 2, 1, 2, 1, 1 … panes (tab 1 is the
one-chat tab between two tabs of several), 20 chats of 11 Replay turns each.
It runs the web's dev build, which renders slower than a built one.

Two loads, both on top of whatever else the Mac was doing (its load average
is beside every run):

- **Load**: the page's CPU at a quarter speed and its main thread held
  120 ms in every 500, both through the DevTools protocol. It is the same
  in every run, so before and after compare.
- **Stream**: a chat streaming on a page the strip holds, a Replay turn
  after another. One chat keeps the main thread in long frames 60–85% of
  the time (median 150 ms, worst 350 ms). Few swipes: every turn stays in
  the lab's chats.

What could not be measured: several chats streaming. With 12 the page drew
1.5 frames a second, with 6 it drew 5, with 2 it drew 6, and a call over the
protocol took 20 s to come back; so did one chat streaming with the CPU at
half speed on the tabs of several panes. A swipe cannot be told from the
rig's own wait there. And a chat fed for an hour grew to hundreds of turns
and the page ran out of memory, so the lab starts each phase from a snapshot.

The cases: `single` an ordinary swipe (300 px, then a coast); `onechat` the
same, onto the one-chat tab from either neighbour; `manychat` the same, off
the one-chat tab onto either neighbour; `quick2` two swipes 160 ms apart
(two pages); `short` 70 px and a coast; `nudge` 60 px let go at rest;
`hard` 1100 px (one page); `slow` a drag let go with no coast; and what
must not turn a page or must still land on one: `vwobble` a scroll down the
page with the fingers straying sideways, `inner` a swipe inside a sideways
scroller, `elsewhere` a scroll down a chat while the strip is in flight,
`rested` fingers resting on the trackpad mid-flight.

## Before

The pager as it was (`6d21a35944`). Other work kept the Mac's load average
between 10 and 60 throughout, which is the person's own condition. "Load"
below is that average in the minute the run began.

30 swipes a case. Wrong: the swipe did not end on the page it should have.

| Case               | Quiet: wrong          | Load | Under load: wrong                   | Load |
| ------------------ | --------------------- | ---- | ----------------------------------- | ---- |
| single             | 2 (two pages)         | 40.8 | 11 (9 two pages, 1 three, 1 none)   | 14.1 |
| onechat            | 0                     | 40.0 | 10 (9 two pages, 1 three)           | 54.9 |
| onechat, no phases | 2 (no page)           | 20.9 | 7 (1 two pages, 6 none)             | 11.2 |
| manychat           | not run               |      | 6 (two pages), of the 15 that could | 18.2 |
| quick2             | 7 (second swipe lost) | 26.1 | 0                                   | 19.6 |
| short              | 0                     | 13.7 | not run                             |      |
| hard               | 0                     | 10.9 | not run                             |      |
| slow               | 0                     | 10.8 | not run                             |      |

`manychat` goes off tab 1 either way, and toward tab 0 there is no page
beyond to skip to: 6 of the 15 swipes toward tab 2 went on to tab 3.

With a chat streaming (26 swipes before the disk ran short): `onechat` 2
wrong, both two pages (load 19.7). An earlier run on chats grown long: 3 of
30, one two pages and two none (load 34.5).

Traced, 12 ordinary swipes:

|                                       | Quiet (load 20) | Under load (load 13.8) |
| ------------------------------------- | --------------- | ---------------------- |
| Finger to strip, median               | 20 ms           | 47 ms                  |
| Finger to strip, p95                  | 74 ms           | 58 ms                  |
| First move shown, median / p95        | 42 / 60 ms      | 61 / 63 ms             |
| Longest the strip stood still, median |                 | 272 ms                 |
| Longest the strip stood still, worst  |                 | 810 ms                 |
| Gaps of more than two frames, a swipe |                 | 8                      |
| Lift to rest, median                  |                 | 1.9 s                  |
| Wrong                                 | 0               | 7 of 12 (two pages)    |

The delay is read at each picture drawn, so a strip that stands still shows
as a gap, not as a delay: under load the old strip's delay reads no worse
than quiet while it stood still for a quarter of a second in every swipe.

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
- **The skip under load**, the same in every trace read: the lift is heard
  142 ms late and the strip lets go; the turn's render holds the main
  thread 806 ms; the coast's last wheel events, merged, are handled 0.5 s
  and 0.7 s late, before the phases that say they are the coast (heard 1 s
  and 1.4 s late). Read from wheel events alone they are fingers, and a
  second page turns.
- **Why a one-chat tab.** It is not the tab: under the same load a swipe
  onto the one-chat tab skipped it 10 times in 30, a swipe off it onto a
  tab of several skipped that 6 times in 15, and a swipe between one-chat
  tabs 10 in 30. Any page with a page beyond it is skipped at the same
  rate. A one-chat tab between busy ones is where a person notices.
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
  a **proxy** (`tabs/proxy.ts`, `proxy.css`). It holds a wide track of snap
  slots and a frame that stays in view. In the frame a **hold** follows the
  proxy's scroll through one scroll-linked animation (`ScrollTimeline`)
  whose keyframes are **knots**: proxy slot → page offset. The strip sits
  in the hold. Fingers, coast and snap all run on the compositor.
- **Walls.** The knots are level past one page either side of the page the
  strip was headed for when a touch began, so one touch shows at most one
  page further however far the proxy goes. The compositor holds the rule;
  no event can break it by being late.
- **Ends.** Past the first or last page the knots rise a quarter of the
  move and come back: the strip gives and returns, on the compositor too.
- **The strip's own place** is a page, and it slides to another by the
  `page` spring, as before: a turn by a click or a key (a far one still
  comes in as the next page), a page a flick is owed, and whatever a change
  of knots would otherwise show as a jump. On screen is the two together.
- **Touches**, where the desktop app's scroll phases say so exactly, and
  only there:
  - A touch that begins while the proxy is in flight moves the walls to
    the page it is headed for. Heard late, the strip catches up by the
    spring instead of jumping.
  - A flick ends one page on in its way. Where the browser's snap leaves
    it on the page it was headed for (the second of two quick swipes,
    lifted before the proxy got there), the strip is owed that page and
    takes it by the spring; that side is then walled, so the touch has one
    page whatever the proxy does next. This is settled two frames after
    the page hears of the lift, when it has also heard where the proxy is
    going. Only a touch whose first wheel event was the proxy's to scroll
    is owed anything.
  - Landed, with the fingers known to be up, the walls go round the page
    landed on at once.
- **At rest** what the proxy shows folds into the strip's own place and the
  proxy goes back to the middle of its track, in one commit. Without
  phases (a browser) this is the only time the walls move.
- **The tab turns when its page has landed**, a frame after the proxy is
  back at rest, not at the lift: a turn renders, focuses and mounts pages,
  and a field focused on a page still arriving would scroll the proxy to
  meet it. Headed two pages off (a second quick swipe) it turns at once, so
  the page a third swipe would bring in is mounted by then.
- **A scroll of the proxy that the fingers didn't make** (a focus, an arrow
  key) is undone in the frame it happened in: only a wheel or a touch over
  the proxy makes its scroll a swipe.
- **Nothing over the proxy may cancel a wheel event**: the composer's
  listener is passive now, and the pager's own are.

### What changes in the feel, and why

- **Letting go.** Was: by distance alone, past 110 px the next page.
  Now: the platform's own rule: flicked, the next page in the flick's way,
  however short; let go at rest, the nearer page, so a slow drag has to
  pass the middle. A rule that sends the
  strip back against its coast needs the main thread at the instant of the
  lift, which is the thing that fails under load: the strip would ride the
  coast the wrong way until the page caught up.
- **The settle** is the browser's snap, not our `page` spring. Turns by
  click and key keep the spring.
- **The tab bar follows when the page lands**, about a third of a second
  after the lift, not at the lift.
- **A border between Cells** stops a swipe while it is held, as the plan
  for it says; hovering one no longer does.
- **Without the scroll phases** (a browser) a second swipe counts once the
  first has come to rest.

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
