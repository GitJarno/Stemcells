# Delegating: a Cell's buds

The delegating row of `cell-life.md`: while a subagent works, a bud of the
Cell stands beside it; one bud for each subagent, two at most; a bud hops
home when its subagent ends.

## Placement

- **On the composer's line.** The Cell stands on the line's top edge at its
  left end. The buds stand on that edge at the Cell's right, in a box the size
  of the Cell's. The box takes no room, so the Cell keeps its place and the
  line's words stay where they were. The line's rim goes round the buds too.
- **In a tab, no buds.** A tab has no room past the Cell. The Cell there plays
  the delegating scene alone: it looks right and nods now and then.
- `CellMark` gains an optional `stage`. The composer's line passes it, and
  nothing else changes for other callers.

## Signals

- A subagent turn item still running, in any run. A subagent sent to the
  background keeps its item running after the turn that started it.
- Upstream's pending background work of kind `subagent`, once the chat stops
  working. The chat then shows Waiting, and its Cell plays delegating instead
  of the hourglass.
- `Task` and `Agent` calls classify as `delegating` (they were `thinking`).
- A bud goes home only once fewer subagents have lasted 3 s, the same wait a
  new activity has before it shows. When a turn hands its subagents to the
  background, it loses sight of them for about a second.

## Plan

- [x] Classifier, bud count, Waiting with subagents away → delegating
- [x] Art: `delegating/0`, `bud/1`, `bud/2`, `bud/out/1`, `bud/out/2`
- [x] `BudRow` (steps one bud at a time, the 3 s stay) and `CellBuds`
- [x] The composer's line passes `stage`
- [x] Live proof: two Claude subagents sent to the background

## Review

On a Claude Cell asked for two subagents in parallel:

- the two buds stepped out at 8–9 s;
- they stayed through the hand-off to the background (Waiting, delegating);
- one went home at 18 s as the first subagent ended;
- the other went home at 24 s.

Before the 3 s stay and the read across runs, the buds went home at the
hand-off and stepped out again 4 s later.
