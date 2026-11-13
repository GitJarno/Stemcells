// A stroke: the hand going back and forth over a Cell, a pointer on the Mac and a finger on the
// phone. One rule for both: three turns, each after a real run, inside a moment. Pure.

/** A hand's travel over one Cell so far. */
export interface Stroking {
  readonly x: number;
  /** The way it last ran: -1 left, 1 right, 0 before it has moved. */
  readonly way: number;
  /** How far it has run that way, in px. */
  readonly run: number;
  readonly turns: number;
  /** When this stroke began, in seconds. */
  readonly since: number;
}

/** A turn counts after a run of `run` px; `turns` of them within `within` seconds are a stroke. */
export const STROKE = { run: 5, turns: 3, within: 1.6 } as const;

/**
 * The hand at `x` at `seconds`, after `before` (undefined as it arrives): how it stands now,
 * and whether that completed a stroke, which starts the count again.
 */
export function stroking(
  before: Stroking | undefined,
  x: number,
  seconds: number,
): { readonly next: Stroking; readonly stroked: boolean } {
  const fresh: Stroking = { x, way: 0, run: 0, turns: 0, since: seconds };
  if (before === undefined || seconds - before.since > STROKE.within)
    return { next: fresh, stroked: false };
  const moved = x - before.x;
  if (moved === 0) return { next: before, stroked: false };
  const way = Math.sign(moved);
  if (way === before.way || before.way === 0)
    return { next: { ...before, x, way, run: before.run + Math.abs(moved) }, stroked: false };
  // A turn after too short a run is a tremble: the run starts over and no turn is counted.
  const turns = before.run >= STROKE.run ? before.turns + 1 : before.turns;
  if (turns >= STROKE.turns) return { next: fresh, stroked: true };
  return { next: { ...before, x, way, run: Math.abs(moved), turns }, stroked: false };
}
