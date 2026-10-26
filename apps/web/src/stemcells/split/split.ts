/**
 * A border between two neighbours, as plain numbers: where a drag or a key
 * puts it. Lengths run along the split (widths beside, heights stacked), in
 * pixels, each neighbour's own without its border.
 */

/**
 * Even is the one detent, and a soft one. Within HOLD pixels of even the
 * pointer finds the border at even; from there to DETENT the border eases
 * back onto the pointer, catching up with it rather than jumping; past
 * DETENT it follows the pointer 1:1.
 */
export const HOLD = 6;
export const DETENT = 20;

/** How far an arrow key moves a border, in pixels. */
export const NUDGE = 16;

/** The lengths of a border's two neighbours. */
export interface Lengths {
  readonly before: number;
  readonly after: number;
}

/** The two neighbours of a border: their lengths and the shortest each may get. */
export interface Neighbours extends Lengths {
  readonly floorBefore: number;
  readonly floorAfter: number;
}

/**
 * Where the detent puts a border whose pointer is `offset` pixels from
 * even, as its own offset from even: 0 within HOLD, the pointer's own past
 * DETENT, and between, a curve that leaves even level and meets the
 * pointer at its pace (a cubic Hermite), so the border never jumps.
 */
export function detent(offset: number): number {
  const away = Math.abs(offset);
  if (away >= DETENT) return offset;
  if (away <= HOLD) return 0;
  const u = (away - HOLD) / (DETENT - HOLD);
  const eased = (3 * u * u - 2 * u * u * u) * DETENT + (u * u * u - u * u) * (DETENT - HOLD);
  return Math.sign(offset) * eased;
}

/**
 * The pair's shortest and longest first neighbour: each keeps its floor, and
 * one already under it (a window made small) may grow but not shrink.
 */
function range({ before, after, floorBefore, floorAfter }: Neighbours) {
  return {
    lowest: Math.min(floorBefore, before),
    highest: Math.max(before + after - floorAfter, before),
  };
}

/** Within this of even, a border is at even (a detent's own rounding). */
const AT_EVEN = 0.5;

/**
 * The neighbours' lengths with their border moved by `delta` from where the press found it: 1:1
 * with the pointer, but for the detent at even, and never past a floor. The press moves nothing:
 * a border found inside the detent but off even, which the detent would pull to even at once,
 * follows the pointer 1:1 for that drag.
 */
export function moveBorder(neighbours: Neighbours, delta: number): Lengths {
  const { before, after } = neighbours;
  const { lowest, highest } = range(neighbours);
  const total = before + after;
  const even = total / 2;
  const found = Math.abs(before - even);
  const moved = before + delta;
  const held = found < AT_EVEN || found >= DETENT ? even + detent(moved - even) : moved;
  const next = Math.min(highest, Math.max(lowest, held));
  return { before: next, after: total - next };
}

/**
 * The neighbours' lengths with their border nudged by an arrow key, NUDGE
 * pixels `toward` (-1, back; 1, forth): a nudge that would cross even stops
 * there, and none passes either floor.
 */
export function nudgeBorder(neighbours: Neighbours, toward: -1 | 1): Lengths {
  const { before, after } = neighbours;
  const { lowest, highest } = range(neighbours);
  const total = before + after;
  const even = total / 2;
  const moved = before + toward * NUDGE;
  const crosses = (before - even) * (moved - even) < 0;
  const next = Math.min(highest, Math.max(lowest, crosses ? even : moved));
  return { before: next, after: total - next };
}

/** The share of the pair the border's first neighbour has, as the separator's value: 0 to 100. */
export function borderValue(before: number, after: number): number {
  return Math.round((100 * before) / (before + after));
}

/**
 * A parent's shares with the neighbours at `index` and `index + 1` sharing
 * what they had between them as `before` to `after`; the rest keep theirs.
 */
export function sharePair(
  shares: readonly number[],
  index: number,
  before: number,
  after: number,
): number[] {
  const pair = shares[index]! + shares[index + 1]!;
  return shares.map((share, at) =>
    at === index
      ? (pair * before) / (before + after)
      : at === index + 1
        ? (pair * after) / (before + after)
        : share,
  );
}
