# Growth: a Cell's strength

The growth line of `cell-life.md`: a Cell grows from the time it has worked
on its own. Growth is the only lasting change to its shape. Its strength
arms are the only limb that stays.

## The tier rule

- **Time worked alone** is per chat, read from the thread's own records:
  - Count each run that landed (status `completed`), from its start
    (`startedAt`) to its landing (`completedAt`).
  - Take off the time that run waited on the person: each blocking request
    of the run, from `createdAt` to `resolvedAt`, or to the landing if it
    was never resolved. Clip waits to the run, and count waits that overlap
    once.
  - A request is blocking by upstream's own test: its response capability
    isn't `message`. An async question the run works on past doesn't stop
    the clock.
  - A request belongs to the run of its node (`nodeId` → `nodes[].runId`).
  - Sum over the thread's runs.
- **Not counted:**
  - Time in the queue (`requestedAt` → `startedAt`).
  - Runs that were stopped, failed or were cancelled: they didn't land.
  - Runs rolled back: the work was undone.
  - A run still going: it counts once it lands.
  - `workStartedAt` isn't used. A run woken by background work copies the
    earlier run's start, so using it would count that time twice.
- **Tiers:**

  | Worked alone | Tier   | Shape                               |
  | ------------ | ------ | ----------------------------------- |
  | under 10 min | none   | the bare Cell                       |
  | 10 min       | nubs   | a nub at each side                  |
  | 30 min       | arms   | short arms, held down at its sides  |
  | 2 h          | biceps | longer arms, bulging over the elbow |

  The thresholds are open to tuning.

- **The flex.** A landing whose own run worked alone for 30 min or more
  plays the flex in place of the cheer. A run that long puts the Cell at arms
  or above, so the flex always has arms to raise.
- **Nothing is stored and nothing counts up.** The tier is worked out from
  the thread's records:
  - once when the Cell is drawn;
  - once as a run starts;
  - once as it lands.

  This is the same read the cold-cache check makes. A rollback can take
  growth back, because the work it stood for was undone. A fork starts from
  its own runs.

## The look

- **The rig's own arms.** These are the arms it grows for a cheer, held at
  rest. A frame that leaves a side's arm free gets the tier's arm on that
  side. A move that raises an arm keeps its own.
- **Reach by tier.** Each tier sets the arm's height, reach and drop. The
  biceps add a bulge over the upper arm: `Arm.bulge`, rows of body with
  light on top. A Cell with biceps bulges in every move that shows its
  arms.
- **Past the box.** The arms reach up to three hero cells past the box on a
  2× display, into the margin a display draws there (#84). Kept inside the
  box, they read as a lumpy outline, not as limbs. On 1×, the miniature
  keeps an arm on its canvas, as the original does for every arm, so
  growth barely shows there.
- **The flex** is the gym's (`gym/flex`): the Cell crouches, throws both
  arms up in a double biceps with `^ ^`, and settles. It is lively, and it
  fits the box at both sizes. Its arm frames draw the arms as art
  (`ownArms`), so a strong Cell's own arms stand aside in those frames and
  hold at rest in the others. The athlete's outfit cheers it too.

## Plan

- [x] Rule: `cell/growth.ts`, the time worked alone and the tier and flex
      from it.
- [x] Read: `growthOf` and `useCellGrowth` (now `useCellLanding`) in
      `upstream/cellWork.ts`, with a contract test over runs, requests and
      nodes decoded by upstream's own field schemas.
- [x] Art: `Arm.bulge` in the rig, the tier arms in `art/moves/growth.json`,
      `ownArms` on the gym's flex.
- [x] Cast: strength in the look (it names its scenes), the flex in place of
      the cheer. `CellMark`'s props stay as they are; `CellFigure` gains
      `strength` and `flexes`.
- [x] Tools: `cells render bare@arms`, `bare@biceps:flex`.
- [x] Proof in the dev app at each tier, plus the flex, dark and light.

## Review

- The first look kept the arms inside the box. They melted into the
  outline at every tier, which is why growth waits on the margin.
- A flex drawn from the rig's straight arms read as antennae. The gym's
  flex, drawn as art, reads as a flex, so it became the one flex.
- With the flex's arms standing aside for all its frames, a strong Cell
  lost its arms between flexes. Now they stand aside only where the flex
  draws arms.
- Proof in the dev app, in `cell-growth.png` in the pages folder:
  - Four chats, their run starts moved back in the dev database: 12 min
    (nubs), 40 min (arms), 2 h 10 min (biceps), and a 35 min run that lands
    a few minutes ahead (the flex, arms).
  - Each Cell showed its tier in its tab and on the composer
    (`data-strength`), and the last one flexed through its cheer. Dark and
    light.
  - A real 30 min run wasn't made for the proof. The rule's arithmetic is
    pinned by the tests over decoded records.
