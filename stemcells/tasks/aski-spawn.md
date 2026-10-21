# Aski's spawn: in, around, out

When one message starts several Cells, Aski acts it out. The message pours
**in**, goes **around** inside the cloud while the Cells are planned, and the
Cells bud **out**. The composer's half (the planner, the readout and where
the act stands) belongs to the prompting work. This file covers Aski's half.

## API (`apps/web/src/stemcells/aski/spawn.ts`)

- `spawnStart(rect, cells, text?)`
  - The message goes.
  - `rect` is where the act plays, in viewport CSS pixels.
  - `cells` may be empty when a plan will pick them.
  - `text` is the message. Without it, the Cells' titles pour in.
- `spawnPlanned(cells?)`: the Cells are known.
- `spawnDone()`: the Cells have started, or the spawn is off.

The calls are safe in any order. A repeat, or a call with no spawn to belong
to, does nothing. One spawn plays at a time. If the composer stops calling,
the act goes on its own after a while (`SPAWN_WAITS`).

## Parts

- **in, around**: `scenes/the-pour.ts`.
  - Thirty letters of the message at most fly in from the left. The cloud
    dims to 0.4 so the letters read over it.
  - The letters then go round on three orbits inside the cloud, each orbit
    the other way from the next, until the plan is in.
  - The still is the message gathered inside.
- **out**: the canon's bud (`scenes/the-bud.ts`). It takes one task word per
  Cell (`taskWord`, shared with many's buds), up to four. More Cells still
  start; only four bud.
- **The theater**: `AskiSpawn.tsx`, mounted beside the workspace's Aski
  keeper.
  - It is a fixed layer at the rect, drawn by the scene worker through
    `MomentPlayer`.
  - It fades in with the act and out once the act is through.
  - Under Reduce Motion each part holds its still.

The canon has no spawn animation; it has only the `spawn.cue` wire schema.
Its bud was never wired to anything, so in and around are new.

## Plan

- [x] The pour card, registered with the scenes; the worker passes an act's
      words and text.
- [x] `spawn.ts` and the theater; tests for the card and the calls.
- [x] Proof in the dev app, driven through `spawn.ts`:
      `aski-spawn.png`, `aski-spawn-reduced-motion.png`.
- [ ] The prompting work calls it from the composer.

## Review

- Proven in the dev app: three Cells bud and land, and the theater goes
  1.3 s after `spawnDone`. Reduce Motion holds the pour's still, then the
  bud's.
- The first pass shuffled every cloud cell at full ink, which read as
  static, not as circling. The orbits over a dimmed cloud read as motion.
- When the plan comes, the dimmed cloud jumps back to full ink at the bud's
  first frame. The jump is short and reads as Aski filling up before it
  buds.
