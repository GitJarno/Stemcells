# Aski's spawn: in, around, out

When one message starts several Cells, Aski plays its part of the spawn
(`stemcells/docs/interaction.md`, The spawn). The words pour in and orbit,
and the streams go out to the panes: those are the composer's to draw. Aski
watches the words in and round, pulses once a stream, and fades. This file
covers Aski's half.

## API (`apps/web/src/stemcells/aski/spawn.ts`)

- `spawnStart(rect, cells?)`
  - The words go.
  - `rect` is where Aski stands, centred, in viewport CSS pixels.
  - `cells` may be empty when a plan will pick them.
- `spawnPlanned(cells?)`: the plan is in and the streams leave. A cell's
  `to` is its pane's box, for Aski's eyes; a cell without one gets eyes
  straight ahead.
- `spawnDone()`: the last stream has landed, or the spawn is off.

The calls are safe in any order. A repeat, or a call with no spawn to belong
to, does nothing. One spawn plays at a time. If the composer stops calling,
Aski goes on its own after a while (`SPAWN_WAITS`).

## Parts (`scenes/the-throw.ts`)

- **in, around**: `theWait`. The body is still. The eyes look down at the
  composer while the letters pour (`letters-span` plus `travel`), then ride
  the orbit, one turn per `orbit-turn`. With no such token yet, the eyes stay
  down.
- **out**: `theThrow`. A row's squash, sprung back on `flick`, as each
  stream leaves: the first at once, then `spawn-stagger` apart, at most four
  in flight, so a fifth leaves when the first lands (`travel`). The eyes are
  on that stream's pane, in the order the composer passes the cells (the
  nearest pane's first). After the last, `^ ^`.
- **The theater**: `AskiSpawn.tsx`, mounted beside the workspace's Aski
  keeper.
  - A fixed layer at the rect, drawn by the scene worker through
    `MomentPlayer`, with the motion tokens' times read on the page.
  - It fades in on `fade` with the act and out on `fade` once the spawn is
    done and Aski has thrown every stream.
  - Under Reduce Motion it plays nothing: Aski doesn't appear.

The canon has no spawn animation; it has only the `spawn.cue` wire schema.

## Plan

- [x] `spawn.ts`, the theater, and the pour and bud parts (#133).
- [x] Rework to the agreed timeline: the wait and the throw replace the pour
      and the bud; Aski draws no letters; `to` per cell; nothing under
      Reduce Motion.
- [x] The bits moment at 1x: its table stays on the stage above the
      composer (from #120).
- [x] Proof in the dev app, driven through `spawn.ts`: `aski-spawn.png`;
      the bits at 1x: `aski-moment-bits-1x.png`.
- [ ] The prompting work calls it from the composer.

## Review

- #133 shipped before the timeline was agreed: Aski poured the message's
  letters itself and budded the Cells. The letters and the streams are the
  composer's, so Aski's half is now only its eyes and its pulses.
- At 1x a stage has half the rows, and the bits table ran a row past the
  stage onto the composer. The table now starts under the eyes, keeps to the
  stage, and grows to the left when it needs more columns.
