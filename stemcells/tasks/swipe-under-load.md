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
- **Every scroll's start waited too**, found once the strip was a native
  scroll: begun while the main thread was held, a swipe did not move until
  the hold ended (first move 60–350 ms late, some after the fingers had
  lifted), though once moving it followed through later holds. The trace
  names it: `InputHandler::ScrollBegin`, `Failed Hit Test`,
  `Request Main Thread Hit Test`, and `FindScrollTargetOnMainThread` when
  the page got to it. The compositor could not tell by itself what the
  scroll starts on, at any point of a page. Taken apart on a bare proxy in
  the lab page, one thing did it: the slate's rounded clip (`overflow:
  clip` with a `border-radius`). Inside it every start is asked of the
  page; with the same clip square, none of 30 was, at five points of a
  page (plain text, a table, a code block, the composer). The same wait
  was on every scroll down a chat. What did not matter once the clip was
  square: the transcript's fade mask, scrollers with nothing to scroll,
  `overscroll-behavior` on boxes that don't scroll.
- **The phases come later than everything else.** Measured on the new
  strip, which still turned two pages 4 times in 450 swipes under load.
  The page's own events (wheel, scroll, the snap's target, rest) come ahead
  of its other work; the system's phases come by a message that queues
  behind it. With a chat streaming, a lift at 141 ms and its coast at
  158 ms were heard at 1600 ms, after the page had landed and the proxy
  had rested. Two orders got through:
  - The page landed, then the flick was heard. Nothing said the proxy had
    already brought that flick its page, so the strip was owed a second
    (2 of 30 onto the one-chat tab with a chat streaming).
  - A flick was owed its page before the page heard where the proxy was
    going, and that side walled. Fingers then came to rest on the trackpad
    (or scrolled the chat): a new touch, which took the walls for its own
    and dropped that one. The proxy landed a slot on after all and counted
    again (3 of 60 `rested`, 1 of 30 `elsewhere`).
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
  only there. The phases are heard late and by any amount, so no rule goes
  by the order things are heard in, only by when each says it happened:
  - A touch takes the walls for its own once it is known to move the proxy:
    it has moved, and its first wheel event was the proxy's to scroll.
    Fingers that only rest on the trackpad, or scroll something else, move
    nothing. If the proxy was under way before the touch began, its walls
    go round the page the proxy was headed for. Heard late, the strip
    catches up by the spring instead of jumping.
  - A flick ends one page on in its way, once. A page the proxy brought
    since the flick's touch began answers for it, however late the flick is
    heard. Else, if the proxy is headed there, that page is the flick's
    when it comes. Else (the second of two quick swipes, lifted before the
    proxy reached the first one's page) the strip is owed that page and
    takes it by the spring, and that side is walled, so the touch has one
    page whatever the proxy does next. This is settled two frames after the
    page hears of the lift, or when the next touch is heard.
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
- **The slate clips square.** Its round corners are the frame's colour
  painted over its square ones, above the panes (`workspace.css`), so the
  compositor can tell what a scroll starts on without the page.

### What changes in the feel, and why

- **Letting go.** Was: by distance alone, past 110 px the next page.
  Now: the platform's own rule: flicked, the next page in the flick's way,
  however short; let go at rest, the nearer page, so a slow drag has to
  pass the middle. A rule that sends the
  strip back against its coast needs the main thread at the instant of the
  lift, which is the thing that fails under load: the strip would ride the
  coast the wrong way until the page caught up.
- **The settle** of a flick lifted short of the middle is still our `page`
  spring (the flick is paid its page two frames after the lift); past the
  middle, and for a drag let go at rest, it is the browser's snap. Turns by
  click and key keep the spring.
- **The tab bar follows when the proxy lands**, not at the lift (measured
  under After).
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
- [x] The baseline under load, and a swipe onto a one-chat tab against one
      onto a many-pane tab
- [x] The knots, as pure functions with tests
- [x] The strip on the proxy: tabs, then the column's stages
- [x] The browser's view rides the proxy (`surfaces/ride.ts`)
- [x] The composer's wheel listener no longer cancels
- [x] Delete the gesture reading the strip no longer uses, with its tests
      and recordings
- [x] The slate clips square, so a scroll's start stays on the compositor
- [x] The touch rules by when things happened, with a replay test that
      hears each story in every order
- [x] The same table after, back to back with before
- [x] What else rides on the strip: click and key turns, the new Cell's
      swipe, settle swipes, a sideways swipe in a code block and in the
      terminal, no phases, narrow panes, the column's stages
- [x] Video before and after, under load

## After

On `stemcells/swipe-under-load`, the same rig and lab. The figures were
taken on three commits of the branch, and each table says which:

- `5dcd045ee5`: the proxy with the touch rules as they are now.
- `19a49c1762`: that, and the eased hand-over of a page owed to a flick.
- `14015131aa`: that, and the tab turning as its page lands. This is the
  code the pull request lands.

### Back to back with the old pager (`19a49c1762`)

The old pager (main as it was merged into the branch), then the new, one
after the other on 10 November, the lab restarted from the same snapshot
for each, the Mac's load average between 4.7 and 8.3 throughout. 30 swipes
a counted case, 12 a traced one.

| Wrong turns                                  | Before                            | Load | After | Load |
| -------------------------------------------- | --------------------------------- | ---- | ----- | ---- |
| Onto the one-chat tab, under load            | 7 of 30 (6 two pages, 1 none)     | 5.8  | 0     | 6.7  |
| An ordinary swipe, under load                | 8 of 30 (7 two pages, 1 three)    | 5.2  | 0     | 6.4  |
| Traced, under load                           | 3 of 12 (two pages)               | 5.7  | 0     | 5.8  |
| Traced, main thread held 400 ms in every 500 | 1 of 12 (two pages)               | 4.8  | 0     | 4.7  |
| Onto the one-chat tab, a chat streaming      | 4 of 30 (1 two pages, 3 off page) | 6.0  | 0     | 4.8  |
| Traced, a chat streaming                     | 4 of 12 (2 two pages, 2 off page) | 6.4  | 0     | 6.7  |
| Traced, quiet                                | 2 of 12 (two pages)               | 6.0  | 0     | 8.3  |

"Off page": the old strip came to rest 5 to 9% of a page short of its page.

Traced, before → after:

|                                          | Under load    | Held 400 in 500 | A chat streaming | Quiet         |
| ---------------------------------------- | ------------- | --------------- | ---------------- | ------------- |
| Finger to strip at each picture, median  | 38 → 10 ms    | 14 → 10 ms      | 19 → 10 ms       | 12 → 10 ms    |
| The same, p95                            | 49 → 14 ms    | 20 → 13 ms      | 42 → 16 ms       | 17 → 13 ms    |
| At every frame of the screen, p95        | 79 → 28 ms    | 118 → 28 ms     | 84 → 42 ms       | 27 → 32 ms    |
| The same, worst                          | 123 → 32 ms   | 126 → 32 ms     | 110 → 125 ms     | 33 → 40 ms    |
| First move shown, median                 | 50 → 29 ms    | 33 → 28 ms      | 33 → 29 ms       | 26 → 28 ms    |
| The same, p95                            | 103 → 30 ms   | 88 → 31 ms      | 56 → 37 ms       | 29 → 30 ms    |
| Longest the strip stood still, median    | 144 → 26 ms   | 407 → 26 ms     | 157 → 25 ms      | 139 → 25 ms   |
| The same, worst                          | 744 → 34 ms   | 416 → 33 ms     | 792 → 122 ms     | 716 → 29 ms   |
| Gaps over two and a half frames, a swipe | 3.4 → 1.0     | 1.8 → 1.0       | 2.6 → 0.6        | 2.7 → 0.7     |
| Swipes that stepped back on their way    | 6 → 0 of 12   | 2 → 0 of 12     | 7 → 0 of 12      | 8 → 0 of 12   |
| The largest step back                    | 394 → 0 px    | 169 → 0 px      | 297 → 0 px       | 107 → 0 px    |
| Lift to rest, median                     | 1.47 → 0.46 s | 0.79 → 0.67 s   | 1.37 → 0.46 s    | 1.28 → 0.46 s |

The screen in the lab draws a frame every 8.4 ms, so p95 of the delay is
within two frames in every column.

What is left in those numbers:

- **The first move is shown 28 ms after the fingers' first event**, loaded
  or not, as it was before when quiet (26 ms). It is the platform's own:
  the event's way to the compositor and one frame.
- **One gap of 25 to 34 ms in every swipe**, at the lift. It is in the
  swipe: between the last event with the fingers down and the first of the
  coast nothing arrives to draw.
- **With a chat streaming, one swipe in 12 stood still for 122 ms** with
  the fingers moving (the worst delay at a frame, 125 ms, is the same
  moment). Its cause was not found. A run on `5dcd045ee5` had none (worst
  42 ms); one of three scratch runs had one of 143 ms.

### On the code that lands (`14015131aa`)

A short run after the last fix, the lab restarted from the snapshot. The
streaming rows and the rest of the table were not run again on this commit.

| Wrong turns                                  | After   | Load |
| -------------------------------------------- | ------- | ---- |
| Onto the one-chat tab, under load            | 0 of 30 | 6.6  |
| An ordinary swipe, under load                | 0 of 30 | 6.5  |
| Traced, quiet                                | 0 of 12 | 6.6  |
| Traced, under load                           | 0 of 12 | 5.8  |
| Traced, main thread held 400 ms in every 500 | 0 of 12 | 7.7  |

|                                       | Quiet      | Under load | Held 400 in 500 |
| ------------------------------------- | ---------- | ---------- | --------------- |
| Finger to strip, median / p95         | 7 / 12 ms  | 8 / 12 ms  | 8 / 12 ms       |
| First move shown, median / p95        | 24 / 28 ms | 27 / 29 ms | 26 / 30 ms      |
| Longest the strip stood still, worst  | 34 ms      | 29 ms      | 32 ms           |
| Swipes that stepped back on their way | 0 of 12    | 0 of 12    | 0 of 12         |
| Lift to rest, median                  | 0.46 s     | 0.46 s     | 0.68 s          |

The tab turns 0.92 s after the lift (median of 12 quiet swipes; 0.90 to
1.14 s), as the proxy lands.

### The whole table (`5dcd045ee5`)

Every case, 30 swipes each (12 traced), quiet and under load. Wrong turns:

| Case               | Quiet   | Load | Under load | Load |
| ------------------ | ------- | ---- | ---------- | ---- |
| onechat            | 0 of 30 | 8.5  | 0 of 30    | 15.3 |
| onechat, no phases | 0 of 30 | 8.6  | 0 of 30    | 20.2 |
| manychat           | 0 of 30 | 7.8  | 0 of 30    | 19.2 |
| single             | 0 of 30 | 6.9  | 0 of 30    | 18.6 |
| single, no phases  | 0 of 30 | 5.5  | 0 of 30    | 6.9  |
| quick2             | 0 of 30 | 7.0  | 0 of 30    | 15.1 |
| short              | 0 of 30 | 8.4  | 0 of 30    | 9.9  |
| hard               | 0 of 30 | 8.1  | 0 of 30    | 10.2 |
| slow               | 0 of 30 | 5.7  | 0 of 30    | 7.0  |
| drag               | 0 of 30 | 5.8  | 0 of 30    | 7.1  |
| nudge              | 0 of 30 | 5.5  | 0 of 30    | 8.4  |
| vwobble            | 0 of 30 | 5.0  | 0 of 30    | 13.3 |
| inner              | 0 of 30 | 5.6  | 0 of 30    | 13.9 |
| elsewhere          | 0 of 30 | 6.9  | 0 of 30    | 11.1 |
| rested             | 0 of 30 | 8.0  | 0 of 30    | 7.6  |
| traced             | 0 of 12 | 7.3  | 0 of 12    | 10.9 |
| traced, held 400   |         |      | 0 of 12    | 9.1  |

With a chat streaming: `onechat` 0 of 30 (load 7.0), traced 0 of 12
(load 9.1). 978 swipes, none wrong. On the commit before it (`690664d5c9`,
the proxy with the touch rules going by the order things were heard in)
the same cases under load and streaming had 4 wrong in 480, all two pages
for one: `rested` 1 of 30, `elsewhere` 1 of 30, `onechat` with a chat
streaming 2 of 30.

A swipe onto the one-chat tab against one onto a tab of several: 0 of 30
each, with the phases and without, quiet and under load (`onechat`,
`manychat`). Before, 10 of 30 and 6 of 15 under load.

### What the bar asks, and what was reached

- No wrong turns under load: reached, 0 in every case.
- One contact of the fingers, one page: reached in every case, and held by
  a test that hears each of ten stories in 400 orders (`proxy.test.ts`).
- The strip under the fingers within a frame or two at p95: reached.
- No runs of dropped frames while dragging or settling: reached under load
  and with the main thread held; not always with a chat streaming (above).

### Found on the way, fixed here

- **A step back at every lift.** A flick lifted short of the middle is paid
  its page by the spring two frames after the lift, and that side walled.
  The wall went straight up where the page last heard the proxy, which was
  two frames (40 to 50 px) behind where it was, so the pages stepped back
  by that at the lift in 12 of 12 quiet swipes. The wall now eases in ahead
  of the proxy (`eased`): the pages follow one to one for the stretch the
  page's word is behind by, then by less, then not at all. 0 of 12 after,
  in every column.
- **The tab turned a spring late.** Landing a hair short of its slot, the
  strip slid the last pixel: a 0.7 s spring nobody sees, and the tab waits
  for a slide to end before it turns. In all 30 quiet swipes, and 12 to 18
  of 30 under load, the tab bar and the focus followed 1.6 s after the
  lift. Under a pixel and a half there is no slide now, and the turn comes
  as the proxy lands: 0.92 s after the lift in the lab's swipe (median of
  12, quiet).

### What else rides on the strip

On `14015131aa`, in the lab:

- **Turns by click and key** (the tabs' own turn): to the next tab, to one
  four away (it comes in as the next page), two turns 120 ms apart. Each
  lands on its tab with the proxy on its rest slot.
- **The column's stages**, on the same strip: a swipe a stage, a hard swipe
  one stage, a swipe past the first stage comes back; the tabs don't move.
- **A swipe over the composer** turns the tab.
- **The new Cell**: a swipe past the last tab brings its page in, and a
  swipe back leaves it.
- **A narrower window**: the proxy stays on its rest slot at the new width,
  and swipes turn.

In the table: a swipe inside a code block scrolls the block (`inner`), a
scroll down a page that strays sideways turns nothing (`vwobble`), and the
`no phases` rows are a browser without the native addon. The media
viewer's swipe keeps its own reading of the wheel, moved to
`media/wheelContact.ts` with its tests. The terminal is under Limits.

### Limits

- **Several chats streaming at once** could not be measured (see The rig):
  the lab's page draws too few frames there to tell a swipe from the wait.
- **A swipe begun over the terminal** still waits for the page. Upstream's
  wheel listener there may cancel (`terminal/ghostty/surface.ts`), so the
  compositor asks the page before it scrolls anything under the pointer.
  The terminal has nothing to scroll sideways: the swipe turns the tab, as
  before, late on a busy page. A seam that leaves sideways events alone
  would fix it.
- **Without the scroll phases** (a browser) a second swipe counts once the
  first has come to rest, and nothing is owed to a flick.
- **A second quick swipe begun while the page is held** shows nothing
  beyond the first one's page until the page hears of the touch; it then
  takes its page by the spring.
- **The tab bar** lights the new tab when the proxy has landed, not at the
  lift: 0.9 s after it in the lab's swipe, whose coast runs 0.63 s, with
  the page itself in place at 0.46 s. The turn waits so that its render
  finds the walls already round the new page: the next swipe then follows
  the fingers on the compositor while the page is busy with the turn.
- **The slate's corners** are painted in the frame's flat colour, without
  the grain the frame has; the slivers are a few pixels. Looked at on the
  dark theme only.
- **The browser's view riding the proxy** (`surfaces/ride.ts`) is covered
  by its unit tests only: the lab has no native view.

## Review

The cause was not one thing. The strip needed the main thread for every
frame; a rule that was right was fed a guess when events came late; and a
rounded clip sent every scroll's start to the page. The proxy takes the
first off the main thread, the walls make the second a property of the
keyframes, and the square clip removes the third.

What the first version of the proxy got wrong was the same mistake one
level up: its touch rules went by the order the page heard things in. The
system's phases come later than the page's own events by any amount, and
4 swipes in 480 still turned two pages. The rules now go by when each
thing says it happened, and the replay test hears every story in orders
the first tests never tried.

Two faults were not wrong turns and no counted case would have found
them: the step back at the lift and the tab turning a spring late. Both
showed only when the traces were read for what the strip did after the
fingers left. The analyzer now reads the step back; nothing yet reads when
the tab turns.

Open: the one streaming swipe in 12 that stood still, the terminal's
listener, and a tab bar that could light as the strip sets off instead of
when it lands.
