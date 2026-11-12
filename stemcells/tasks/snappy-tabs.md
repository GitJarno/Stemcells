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

## Plan

- [x] The rig, the baseline, a profile and a timeline of one turn
- [x] The whole page restyled at every change: one selector of ours
- [ ] What a turn still asks of the main thread, one cause at a time
- [ ] The rig in the repository, the same table after, one pass in the
      real app

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

## Review
