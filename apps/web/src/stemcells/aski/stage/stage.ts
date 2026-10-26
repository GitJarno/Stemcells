// Where each awake Cell stands around Aski: at work it orbits, starting or landed it stands on
// the ground line, needing you it steps out to the front. Pure, so the rules are tested without
// a browser; `AskiStage.tsx` moves the Cells. The numbers are theater: hand-set for this one
// composition, in shares of Aski's size.

/** What the stage reads of a Cell. */
export interface StageCell {
  readonly key: string;
  /** Its stage as core sent it; a word the stage does not know places it as Working. */
  readonly stage: string;
  readonly bornAt: number;
  /** While it needs you: when the need began. */
  readonly needSince?: number;
  /** In its close's grace: off the stage, inside Aski, until Undo or the end of the grace. */
  readonly closing: boolean;
}

/** The three places on the stage. */
export type Place = "orbit" | "ground" | "front";

/** The sides of Aski on its ground line: trailing is the side text runs toward. */
export type Side = "trailing" | "leading";

/** Where a Cell stands: its place and, on the ground line and at the front, its order there. */
export type Spot =
  | { readonly place: "orbit" }
  | { readonly place: "ground"; readonly side: Side; readonly index: number; readonly of: number }
  | { readonly place: "front"; readonly index: number; readonly of: number };

/**
 * How a Cell came to its spot: it `appears` there with no motion, `arrives`
 * out of Aski, `moves` from another place, or `stays` in its place (its
 * order there may still close up).
 */
export type Entry = "appears" | "arrives" | "moves" | "stays";

/** Who stands where, in order: what the next casting starts from. */
export interface Cast {
  readonly ground: { readonly trailing: readonly string[]; readonly leading: readonly string[] };
  readonly front: readonly string[];
  readonly orbit: readonly string[];
  /** Cells in their close's grace: they went into Aski and come back out of it on Undo. */
  readonly inside: readonly string[];
}

export interface Casting {
  readonly cast: Cast;
  /** Every Cell on the stage, its spot and how it got there, in a stable order. */
  readonly spots: ReadonlyMap<string, { readonly spot: Spot; readonly entry: Entry }>;
  /** The Cells that left the stage: each hops into Aski. */
  readonly left: readonly string[];
}

/** The place a stage puts a Cell in. */
export function placeOf(stage: string): Place {
  switch (stage) {
    case "starting":
    case "landed":
      return "ground";
    case "needsYou":
      return "front";
    default:
      return "orbit";
  }
}

const byBirth = (a: StageCell, b: StageCell): number =>
  a.bornAt - b.bornAt || (a.key < b.key ? -1 : 1);
const byNeed = (a: StageCell, b: StageCell): number =>
  (a.needSince ?? a.bornAt) - (b.needSince ?? b.bornAt) || byBirth(a, b);

/**
 * Puts the Cells on the stage from `before` (absent on the first casting: each appears in
 * place, nothing animates). A Cell keeps its spot while its place holds; one arriving on the
 * ground line takes the outer end of the side with fewer (trailing on a tie), one leaving closes
 * its side's gap, so no Cell crosses Aski. The front keeps the order the needs began in.
 */
export function cast(before: Cast | undefined, cells: readonly StageCell[]): Casting {
  const was = before ?? { ground: { trailing: [], leading: [] }, front: [], orbit: [], inside: [] };
  const on = new Map<string, Place>();
  for (const place of ["orbit", "front"] as const) for (const key of was[place]) on.set(key, place);
  for (const key of [...was.ground.trailing, ...was.ground.leading]) on.set(key, "ground");
  const inside = new Set(was.inside);

  const awake = cells.filter((c) => !c.closing);
  const placed = new Map(awake.map((c) => [c.key, placeOf(c.stage)]));
  const stays = (key: string, place: Place): boolean =>
    on.get(key) === place && placed.get(key) === place;
  const newcomers = (place: Place, order: (a: StageCell, b: StageCell) => number): string[] =>
    awake
      .filter((c) => placed.get(c.key) === place && on.get(c.key) !== place)
      .sort(order)
      .map((c) => c.key);

  const trailing = was.ground.trailing.filter((k) => stays(k, "ground"));
  const leading = was.ground.leading.filter((k) => stays(k, "ground"));
  for (const key of newcomers("ground", byBirth))
    (trailing.length <= leading.length ? trailing : leading).push(key);
  const front = [...was.front.filter((k) => stays(k, "front")), ...newcomers("front", byNeed)];
  const orbit = [...was.orbit.filter((k) => stays(k, "orbit")), ...newcomers("orbit", byBirth)];

  const entry = (key: string, place: Place): Entry => {
    const from = on.get(key);
    if (from === place) return "stays";
    if (from !== undefined) return "moves";
    if (before === undefined) return "appears";
    const cell = awake.find((c) => c.key === key);
    return inside.has(key) || cell?.stage === "starting" ? "arrives" : "appears";
  };
  const spots = new Map<string, { spot: Spot; entry: Entry }>();
  for (const key of orbit) spots.set(key, { spot: { place: "orbit" }, entry: entry(key, "orbit") });
  for (const [side, keys] of [
    ["trailing", trailing],
    ["leading", leading],
  ] as const) {
    for (const [index, key] of keys.entries()) {
      spots.set(key, {
        spot: { place: "ground", side, index, of: keys.length },
        entry: entry(key, "ground"),
      });
    }
  }
  for (const [index, key] of front.entries()) {
    spots.set(key, {
      spot: { place: "front", index, of: front.length },
      entry: entry(key, "front"),
    });
  }

  const left = [...on.keys()].filter((key) => !spots.has(key));
  const closing = new Set(cells.filter((c) => c.closing).map((c) => c.key));
  return {
    cast: { ground: { trailing, leading }, front, orbit, inside: [...closing] },
    spots,
    left,
  };
}

/** A point on the stage in CSS pixels, from the middle of Aski's feet: x toward the trailing side, y down. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A Cell as drawn: where its feet are, its size and its opacity. */
export interface Pose extends Point {
  readonly scale: number;
  readonly opacity: number;
}

/** What the stage is laid out from, in CSS pixels. */
export interface Metrics {
  /** The stage's width. */
  readonly width: number;
  /** The side of the square Aski is drawn in, its feet on the square's foot. */
  readonly aski: number;
  /** A Cell's character. */
  readonly cell: { readonly width: number; readonly height: number };
  /** Between two Cells standing side by side. */
  readonly gap: number;
}

/** The orbit: an ellipse around Aski's middle, seen from a little above, and how long one turn takes. */
export const ORBIT = {
  /** Half its width and half its height, in shares of Aski's size. */
  rx: 0.74,
  ry: 0.15,
  /** Its middle above the ground, in shares of Aski's size: Aski's own middle. */
  lift: 0.47,
  /** One turn, in milliseconds. */
  period: 16_000,
  /** Drawn smaller and fainter at its far side, as if further away. */
  far: { scale: 0.82, opacity: 0.55 },
  /** The least angle between two Cells in it, in radians. */
  gap: 0.6,
} as const;

/** Clear of Aski on the ground line, in shares of Aski's size: Aski's ink is as wide as its square. */
const GROUND_CLEAR = 0.56;

/**
 * The orbit on a stage given room to sweep round Aski (the main window's Aski's page): out to about two fifths of
 * the stage's width each side, at most a few of Aski's sizes, never tighter than the orbit above, and flatter. Along
 * its line it goes at the same pace, so a turn takes longer.
 */
export const WIDE = { share: 0.42, most: 2.9, ry: 0.3 } as const;

/** The orbit laid out for a stage. */
export interface Orbit {
  readonly rx: number;
  readonly ry: number;
  /** Its middle's y: above the ground, so negative. */
  readonly cy: number;
  /** One turn, in milliseconds. */
  readonly period: number;
}

/** The orbit for a stage; `wide`, swept out across it. */
export function orbitOf(m: Metrics, wide = false): Orbit {
  const rx = ORBIT.rx * m.aski;
  const cy = -ORBIT.lift * m.aski;
  if (!wide) return { rx, ry: ORBIT.ry * m.aski, cy, period: ORBIT.period };
  const swept = Math.max(rx, Math.min(WIDE.share * m.width, WIDE.most * m.aski));
  return { rx: swept, ry: WIDE.ry * m.aski, cy, period: (ORBIT.period * swept) / rx };
}

/**
 * A Cell in the orbit at `angle`. The near half, in front of Aski, is where
 * the sine is positive; the Cell's feet sit half its height below the
 * ellipse, so its middle rides it.
 */
export function orbitPose(o: Orbit, m: Metrics, angle: number): Pose {
  const near = (1 + Math.sin(angle)) / 2;
  const scale = ORBIT.far.scale + (1 - ORBIT.far.scale) * near;
  return {
    x: o.rx * Math.cos(angle),
    y: o.cy + o.ry * Math.sin(angle) + (m.cell.height * scale) / 2,
    scale,
    opacity: ORBIT.far.opacity + (1 - ORBIT.far.opacity) * near,
  };
}

/** Whether a Cell at `angle` passes behind Aski. */
export const behind = (angle: number): boolean => Math.sin(angle) < 0;

/** Where a Cell in the orbit is at `time` (ms), from the angle it holds at time 0: the orbit turns toward the trailing side in front. */
export const angleAt = (offset: number, time: number, period: number = ORBIT.period): number =>
  offset - (2 * Math.PI * time) / period;

/** The angle at time 0 of a Cell that is at `angle` at `time`. */
export const offsetOf = (angle: number, time: number, period: number = ORBIT.period): number =>
  angle + (2 * Math.PI * time) / period;

const turn = (a: number): number => {
  const r = a % (2 * Math.PI);
  return r < 0 ? r + 2 * Math.PI : r;
};
const apart = (a: number, b: number): number => {
  const d = turn(a - b);
  return Math.min(d, 2 * Math.PI - d);
};

/**
 * The angle a Cell coming from `from` joins the orbit at: in the near half, in front of Aski,
 * as close to `from` as leaves `ORBIT.gap` from each of `taken`, else the angle furthest from
 * them. `anywhere` allows the far half too, for a Cell that appears in the orbit rather than
 * travelling into it.
 */
export function joinAngle(
  o: Orbit,
  m: Metrics,
  from: Point,
  taken: readonly number[],
  anywhere = false,
): number {
  const steps = anywhere ? 144 : 72;
  const span = anywhere ? 2 * Math.PI : Math.PI;
  const angles = Array.from({ length: steps + 1 }, (_, i) => (span * i) / steps);
  const distance = (a: number): number => {
    const p = orbitPose(o, m, a);
    return Math.hypot(p.x - from.x, p.y - from.y);
  };
  const clearance = (a: number): number => Math.min(Math.PI, ...taken.map((b) => apart(a, b)));
  const byNearness = [...angles].sort((a, b) => distance(a) - distance(b));
  return (
    byNearness.find((a) => clearance(a) >= ORBIT.gap) ??
    byNearness.reduce((best, a) => (clearance(a) > clearance(best) ? a : best), byNearness[0]!)
  );
}

/** Where a spot on the ground line or at the front puts a Cell's feet. */
export function spotPoint(spot: Exclude<Spot, { place: "orbit" }>, m: Metrics): Point {
  const step = m.cell.width + m.gap;
  if (spot.place === "front") {
    // A row under the ground line, centred, closing up to fit the stage.
    const room = m.width - m.cell.width;
    const pitch = spot.of > 1 ? Math.min(step, room / (spot.of - 1)) : 0;
    return { x: (spot.index - (spot.of - 1) / 2) * pitch, y: m.cell.height + m.gap };
  }
  // Outward from Aski along one side, closing up to fit the stage.
  const first = GROUND_CLEAR * m.aski + m.cell.width / 2;
  const room = m.width / 2 - m.cell.width / 2 - first;
  const pitch = spot.of > 1 ? Math.max(0, Math.min(step, room / (spot.of - 1))) : 0;
  const x = first + spot.index * pitch;
  return { x: spot.side === "trailing" ? x : -x, y: 0 };
}

/** Aski's middle, where a Cell comes out of and hops back into. */
export const askiMiddle = (m: Metrics): Point => ({ x: 0, y: -ORBIT.lift * m.aski });
