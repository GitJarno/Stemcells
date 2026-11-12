# A tab turns at once, even on a busy Mac

The person: with a heavy workload on the laptop, going between tabs gets
really slow, and it always has to be snappy.

`swipe-under-load.md` put the swipe's motion on the compositor: the strip
follows the fingers whatever the page is doing. What is left is everything
a turn asks of the page's main thread, which a busy Mac gives it in slices:
the turn's own render, the pages it mounts, and whatever else the page is
doing when the turn is asked for.

## The bar

Under the load case, a click on a tab lights it and starts its page moving
within 100 ms at p95, and the page is the person's to type in within
200 ms. A tab never turned to before is no worse than one beside the tab on
stage. With nothing happening on stage, the page's main thread is idle.

## The lab

The built web app (not the dev build, which renders several times slower)
served by a server on a lab home: every provider a fake, 22 chats on the
free Replay agent, each eight long turns of history (headings, lists, a
table, code, tool calls, an edit). 16 tabs of 1 to 3 chats. A headless
Chromium clicks a tab and the page's own clocks say when the tab lit, when
its page moved and came to rest, and how long the main thread was held in
the two seconds after.

- **near**: back and forth between two tabs side by side, both mounted.
- **far**: to a tab five away each time, never mounted when turned to.
- **quiet**, and **slowed**: the page's CPU at a quarter speed through the
  DevTools protocol, the same in every run. The Mac's own load average is
  beside each run: other work kept it between 13 and 48.

The rig is `stemcells/lab/turns/`. `lab-up.sh <repo> <port>` makes the lab
home and starts the server on the built web app (`vp build` in `apps/web`
first); `transcript.py` writes the long Replay transcript and `chats.sh`
starts the chats; `table.sh <repo> <name>` measures the four cases,
`stream.sh <repo> send <line>...` sets chats streaming under them, and
`behave.mjs <repo>` checks what a turn must leave true: the tab lit, one
page on stage and only it taking input, the caret in its composer, the
address on its chat, by a click, a cold tab, quick clicks and a swipe.

## Plan

- [x] The rig, the baseline, a profile and a timeline of one turn
- [x] The whole page restyled at every change: one selector of ours
- [x] What a turn still asks of the main thread, one cause at a time
- [x] The rig in the repository, the same table after
- [ ] A tab never mounted: its page mounts in one long task
- [x] The same turns with chats streaming
- [ ] One pass in the desktop app

## What the baseline showed

Milliseconds after the click, median / p95 of 10 turns.

|                         | near, quiet | near, slowed  | far, quiet  |
| ----------------------- | ----------- | ------------- | ----------- |
| The tab lit             | 90 / 97     | 463 / 548     | 1417 / 2710 |
| The page moved          | 146 / 154   | 765 / 930     |             |
| Main thread held after  | 2953 / 3251 | 10574 / 15411 | 5252 / 7310 |
| The longest single hold | 2836 / 3120 | 9725 / 14569  | 3758 / 5865 |
| The Mac's load average  | 33          | 32            | 34          |

A turn to the tab next door lit in 90 ms and then held the page for three
seconds, in one frame. Slowed, ten to fifteen. Far and slowed, a tab lit 6
to 12 s after its click and its neighbours came 20 to 40 s later.

The profile of those three seconds had almost no React and no script of
ours in it. It was the browser working out styles, each time something
asked where a thing was: the transcript measuring its rows, the composer's
editor setting an attribute, the composer measuring its buttons. The
timeline said why: each of those restyled 28,000 to 31,000 elements, the
whole page, about 200 ms a time.

## The whole page restyled at every change

One element added anywhere (a word in a chat, a tab, the sidebar) cost a
175 ms style pass over every element on the page. With every `:has()` rule
switched off in the live page, 0 ms.

Two things made it, together:

- A rule of ours for the dock's halo (`glow.css`):
  `[data-chat-composer-stack] > :not(:has(.composer-line-ledge)) [data-slot="composer-shell"]`.
  Chrome matches a selector from its subject and tries every ancestor of
  the box against the compound before it. That compound names nothing but
  its `:has()`, so the `:has()` ran on every ancestor of every composer, up
  to the root, and each was marked: a change under it may change what it
  matches.
- The rules the browser then rechecks under a marked element. It keeps one
  list for all the `:has()` rules on the page, and that list said
  "everything below": Tailwind's `group-has-*` classes (upstream's) are
  written in a form it cannot narrow, and so are two rules of ours that
  end in `> :not(...)`.

So every change, under the root, restyled everything. Each rule alone was
harmless: on a bare page of 20,000 elements none of twenty shapes of
`:has()` rule cost anything, and in the live page the halo's rule alone
cost 0.1 ms. It has been there since 21 October.

The fix: the ledge and the box each get an anchor name of their own, and
the halo asks for the ledge's first (`anchor(--sc-dock-ledge top,
anchor(--sc-dock-box top, 0px))`). No `:has()`. `restyle.test.ts` held
only a selector's subject to naming something; it now holds every
compound, and failed on this rule before the fix.

One element added, the style pass after it:

|        | In a chat | In the composer | In the tab strip | In the sidebar |
| ------ | --------- | --------------- | ---------------- | -------------- |
| Before | 173 ms    | 170 ms          | 174 ms           | 185 ms         |
| After  | 0.1 ms    | 1.2 ms          | 0.2 ms           | 0.3 ms         |

The same turns after (8 each):

|                         | near, quiet | near, slowed | far, quiet | far, slowed |
| ----------------------- | ----------- | ------------ | ---------- | ----------- |
| The tab lit             | 77 / 82     | 384 / 502    | 157 / 310  | 946 / 1704  |
| The page moved          | 129 / 137   | 663 / 847    |            |             |
| Main thread held after  | 354 / 413   | 1911 / 2302  | 874 / 1024 | 1709 / 2230 |
| The longest single hold | 256 / 294   | 1312 / 1555  | 509 / 591  | 1334 / 2230 |
| The Mac's load average  | 14          | 13           | 13         | 20          |

The halo stands where it stood: 16 px over the ledge's top, and over the
box's top where the ledge is gone (measured in the lab page both ways).

It was never only tabs. A word streaming into a chat, a tooltip, a key in
the composer each added an element and paid the same pass.

## A turn in two steps

After the restyle, a click still did everything in one render before the
tab lit: the strip, both pages changing hands, the pages a turn brings in,
and the route, which renders every mounted chat. Slowed, 384 ms to light.

- **The tab lights and the strip moves in the click's own render; the
  stage changes hands once that has drawn.** Which page takes input, focus
  and the keys is a state of its own (`stagedTabId`), set after the paint.
- **The route follows the hand-over, a frame after the chat took focus.**
  A route change renders every mounted chat (upstream's `ChatView` reads
  the location), and before the focus frame it held the caret back 250 ms.
- **A swipe's tab lights when the swipe is headed there**, not when its
  page has landed: the strip already says where it is headed (`onAim`).
- **Pages stay mounted by use, not by distance.** Two tabs either side
  were kept and the rest unmounted, so going between two tabs three apart
  mounted and unmounted pages at every turn. Now up to ten stay: the
  neighbours, the last visited, and what was there (`keep`).
- **A page nobody asked for mounts when the hands are still** (`still.ts`):
  the page idle and 600 ms since a key, a press or a scroll, one page at a
  time (`settle`). The page turned to mounts with the hand-over.
- **A render that moved nothing reads nothing from the strip.** `sync` ran
  after every render of the workspace and asked a sliding strip where it
  was: a style pass each time.
- **Only the fingers aim the strip.** The browser's word on where a scroll
  will snap was taken from any scroll, so a field scrolling the proxy to
  show itself could turn the tab (a test failed on it once in eight runs
  under load). Now pinned: `TabPager.browser.test.tsx`.

### Not a transition

The first cut handed the stage over with `useDeferredValue` and let pages
in with `startTransition`. Quiet, it measured well. With six chats
streaming and the page slowed, the tab lit in 32 ms and its page took the
stage 6 s later, 15 s at p95: React drops a transition's render for every
urgent one and starts it over, a streaming chat is an urgent render every
30 ms, and the hand-over got through only when React forced it after five
seconds. A page let in the same way would have rendered again and again
for as long.

So both are plain updates. The hand-over runs after the paint in a task
the browser puts ahead of those waiting (`afterPaint.ts`,
`scheduler.postTask`), and renders there and then: as a plain task it
still waited a second behind the chats' renders.

### The same turns after

8 each, median / p95, main's in brackets where it was measured.

|                         | near, quiet | near, slowed    | far, quiet | far, slowed      |
| ----------------------- | ----------- | --------------- | ---------- | ---------------- |
| The tab lit             | 3 / 5 (77)  | 14 / 16 (384)   | 3 / 20     | 17 / 126 (946)   |
| The first frame after   | 40 / 40     | 88 / 88 (624)   | 40 / 64    | 104 / 216        |
| The caret in its chat   | 85 / 104    | 394 / 448 (553) | 148 / 178  | 804 / 970 (1192) |
| Main thread held after  | 68 / 122    | 665 / 972       | 422 / 525  | 1689 / 1959      |
| The longest single hold | 68 / 86     | 336 / 390       | 148 / 190  | 717 / 1044       |
| The Mac's load average  | 48          | 39              | 29         | 23               |

With six chats streaming a long turn each (`stream.sh`, on a transcript
from `transcript.py <file> 0 30`), between two mounted tabs, main and this
build one after the other:

|                       | quiet, main | quiet, now | slowed, main | slowed, now |
| --------------------- | ----------- | ---------- | ------------ | ----------- |
| The tab lit           | 85 / 89     | 3 / 10     | 491 / 552    | 32 / 36     |
| The first frame after | 168 / 184   | 48 / 72    | 768 / 856    | 144 / 168   |
| The caret in its chat | 126 / 132   | 117 / 129  | 692 / 776    | 773 / 914   |
| The longest hold      | 234 / 244   | 97 / 249   | 706 / 786    | 677 / 812   |
| The Mac's load        | 68          | 98         | 75           | 94          |

The slide itself runs on the compositor from the first frame. The rig's
"page moved" reads the strip's place on the main thread, which the
hand-over now holds right after that frame, so the first frame is the row
to read.

What is left in a turn between mounted tabs is the hand-over itself:
`inert` leaving one page and taking the other restyles both (about 50 ms
quiet), then React's render and the focus. `inert` stays: it is what keeps
a hidden page out of select-all, the tab order and a screen reader.

## Review

The bar asked for a lit tab and a moving page within 100 ms at p95 under
load, and typing within 200 ms.

- Lit and moving: met. Slowed to a quarter, 16 ms and 88 ms at p95, from
  500 and 850; with six chats streaming as well, 36 and 168.
- Typing: met quiet (104 ms), not slowed (448 ms, from 553), and with
  chats streaming it is where it was (773 ms against 692).
- A tab never mounted lights at once and its page still mounts in one
  task: 150 ms quiet, 700 ms slowed. With ten tabs or fewer every page is
  mounted after a still moment, so this is the eleventh tab on, and the
  first turn after a reload.
- From the baseline, a turn next door held the page 2953 ms and now holds
  it 68; slowed, 10574 and now 665.

Not done: the cold page's mount (the plan's next line), and a pass in the
desktop app. And one thing given up: a page beside the stage used to
mount in the turn's own render, and now waits for still hands, so a swipe
in the first second after a reload, or along more than ten tabs, slides a
bare page in and fills it as it lands.

What I'd keep:

- Measure in the built app. The dev build renders several times slower
  and hid the restyle behind React's own cost.
- A style cost has no stack. The profile said "recalculate style" under
  whatever asked a question first; only the timeline's element counts said
  the whole page was in it.
- Measure with the page doing what it does all day. The transition design
  passed every quiet run and a review, and handed the stage over ten
  times later than main the first time chats streamed under it.
