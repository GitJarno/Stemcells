# Aski's moments

Aski has a handful of short scenes it plays when something good happened
that the person would want to know: a Cell's work merged, a crew ran while
they were away, the connection came back without losing anything. Each one
says one true line with real numbers and returns Aski to rest. They are
rare by design.

## Rules

- **One budget, shared with the Cells.** `motion/lively.ts` keeps the rare
  beats played in the last hour, in local storage, so every window spends
  from one budget. About three an hour, never the same one twice in a row.
  A Cell's rare beat takes from the same budget.
- **Nothing celebrates while anything needs the person.** While a Cell or
  Aski's own chat waits on them, the budget refuses.
- **Reduce Motion** holds each moment's telling frame (the card's `still`),
  and the line shows whole with no cursor.
- **Each moment has its own rarity** on top of the budget: first of the day,
  once per Cell, once per message. Its seen-state is kept with it.
- **Real numbers only.** A moment whose number T3 doesn't have is dropped.
- **Pictures in the grid, words in the line.** Aski's font at a scene's
  cell size draws a picture, not readable text, so every word a moment says
  is in its one line, typed to Aski's right in the page's mono face. What a
  moment draws stays in Aski's square or to its left, clear of the line (a
  test holds every moment to it).
- **Seen, not glimpsed.** A moment plays once Aski has been in sight for a
  second; one earned while Aski is out of sight waits up to ten minutes for
  the person to look. A stage put up and taken down spends nothing.

## Engine

The canon's scene engine: a moment is a `SceneCard`, a pure
`frame(t, stage)` drawn by the scene worker's `GridPainter` over Aski's
figure, starting and ending at Aski at rest so the figure fades out and back
without a seam (`stage/stage-scene.ts` places the grid). Moments add:

- moods typed into the grid's eyes (`mood(t)`), as the figure has them;
- one eye can leave its place (a place with only the eye that stays);
- arguments to a card (its numbers), sent to the worker with the play;
- `moments/player.ts`, which plays one moment on a stage that is not core's;
- `moments/AskiMoments.tsx`, the theater around Aski's figure: it asks the
  budget, plays, and types the line; it earns the moments that come of
  looking at Aski (the bits, the night).
- `moments/AskiMomentWatch.tsx`, mounted beside the workspace's Aski keeper,
  watches for the rest whether Aski's page is mounted or not (the tab pager
  unmounts a page four visits away). What it earns waits in
  `moments/earned.ts` until Aski is in sight.

## The moments

| id     | Line                                 | Trigger                                                        | Data                                  |
| ------ | ------------------------------------ | -------------------------------------------------------------- | ------------------------------------- |
| bits   | Seven bits. All of them.             | Seven clicks on Aski within 3 s                                | clicks                                |
| back   | Back. Nothing dropped.               | Reconnected after 30 s or more silent, no run failed meanwhile | connection phase, shells' latest runs |
| night  | The night shift is theirs.           | First look after 23:00 while Cells work; once a night          | clock, standings, presence            |
| news   | 3 landed while you were out.         | Back after an hour or more away, with Cells landed meanwhile   | server's away stretch, latest runs    |
| many   | Talk to one. Run many.               | Five or more Cells started from one Aski message               | shells' lineage and creation source   |
| things | Words became things.                 | A Cell Aski started lands with new files; first of the day     | the turn's diff                       |
| zipped | Zipped into main.                    | A Cell's PR merged; first of the day or 300+ lines             | shells' pull requests                 |
| window | Window's open. 2 Cells carried on.   | A usage limit reset and Cells resumed on their own             | shells' limit recovery                |
| pages  | Same thread, fewer pages.            | A Cell compacted on its own; once per Cell                     | the thread's turn items               |
| clear  | (none: the needs list says it)       | Three or more asks answered down to none within 30 min         | standings over time                   |
| haul   | An hour of work. No questions asked. | A run of an hour or more that never asked, watched whole       | latest runs, standings over time      |

Dropped, because T3 keeps no such number:

- **record** (most landed in one day): T3 keeps only each thread's latest
  run, not a history of runs per day. The usage summary has tokens and cost
  per day, not landed work.
- **receipt** (hours of work off your plate, weekly): no total of hours
  worked or of asks answered exists; it would have to be invented.

## PRs

1. Engine and budget, with **bits**, **back** and **night**.
2. **news** (with the server's away stretch), **many**, **clear**, **haul**.
3. **zipped**, **window**, **pages**, **things**.

## Plan

- [x] PR 1: engine, budget, bits, back, night; proofs (`aski-moment-{bits,back,night}.png`, `aski-moments-reduced-motion.png` beside the lookbook)
- [ ] PR 2: news, many, clear, haul; proofs (`aski-moment-{news,many,clear,haul}.png`); CI green
- [ ] PR 3: zipped, window, pages, things; proofs; CI green

## Review
