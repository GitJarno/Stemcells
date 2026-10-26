// The rig: a Cell's body as one soft mound deformed per frame, a pure function from pose to
// body. A squash keeps the volume (sx = 1 / sy^0.75), a lean shears the crown over a planted
// base, a spread melts the base; the face slides across and hides where it leaves the body.
// At rest the hero is `HERO` cell for cell; the miniature is drawn, never the hero halved.

import { EYES, MINI, MOUTHS, RIG, type Pose } from "./kit.ts";
import {
  type Anchor,
  anchorOf,
  type Body,
  Grid,
  type Layer,
  miniOf,
  type Narrowed,
  type Point,
  round,
} from "./sprite.ts";

const PROFILE = RIG.profile;

function halfWidth(t: number): number {
  const c = Math.min(Math.max(t, 0), PROFILE.length - 1);
  const i = Math.trunc(c);
  const f = c - i;
  return i + 1 < PROFILE.length ? PROFILE[i]! * (1 - f) + PROFILE[i + 1]! * f : PROFILE[i]!;
}

/** The width that keeps the volume at height scale `sy`. */
function keptWidth(sy: number): number {
  const root = Math.sqrt(sy);
  return 1 / (root * Math.sqrt(root));
}

/** Rows the body takes at height scale `sy`. */
const rowCount = (sy: number): number => Math.max(3, round(RIG.restRows * Math.max(sy, 0.25)));

/** The body at rest as worn pieces are drawn for it: each row's half-width from the base. */
const REST_HALVES = Array.from({ length: RIG.restRows }, (_, r) => {
  const left = round(RIG.restX + 0.5 - halfWidth(r));
  const right = round(2 * RIG.restX) - left;
  return (right - left + 1) / 2;
});

/** The rows from the base each anchor stands on at rest. */
const REST_HEIGHTS: Partial<Record<Anchor, number>> = {
  headTop: RIG.restRows - 1,
  eyes: 9,
  mouth: 5,
  torso: 3,
  hold: 2,
  back: 9,
  ground: -1,
};

interface Span {
  left: number;
  right: number;
}

/** The row the hero's headwear rides in `pose`. */
export const crown = (pose: Pose): number =>
  pose.base - pose.float - (rowCount(pose.sy) - 1) - pose.lift;

const MINI_FLOOR = anchorOf(MINI, "ground").y - 1;
const MINI_TALL = MINI_FLOOR - anchorOf(MINI, "headTop").y + 1;

/** The row the miniature's headwear rides in `pose`. */
export function miniCrown(pose: Pose): number {
  const rows = Math.max(3, round(MINI_TALL * Math.max(pose.sy, 0.25)));
  const base = MINI_FLOOR + Math.floor((pose.base - pose.float - RIG.restBase) / 2);
  return base - (rows - 1) - round(pose.lift / 2);
}

/** The hero body in `pose` on a `w` × `h` grid. */
export function hero(rigged: Pose, w = 32, h = 32): Body {
  const pose = { ...rigged, base: rigged.base - rigged.float, float: 0 };
  const sy = Math.max(pose.sy, 0.25);
  const sx = pose.sx ?? keptWidth(sy);
  const rows = rowCount(sy);
  const top = rows - 1;
  const grid = new Grid(w, h);
  const spans: Span[] = [];
  const centre = (r: number) => pose.x + (pose.lean * r) / rows;
  const column = (r: number, dx = 0) => Math.floor(centre(r) + dx - 0.5);

  for (let r = 0; r < rows; r++) {
    const t = (r + 0.5) / sy - 0.5;
    const half = halfWidth(t) * sx + pose.spread * Math.max(0, 1 - r / 3);
    const left = round(centre(r) + 0.5 - half);
    const right = round(2 * centre(r)) - left;
    spans.push({ left, right });
    for (let x = left; x <= right; x++) {
      grid.put(x, pose.base - r, r < RIG.shadeRows || x >= right - (RIG.shadeRows - 1) ? "b" : "B");
    }
  }
  // The gloss: two cells inside the crown's left shoulder, one beneath.
  if (rows >= 4) {
    const left = spans[rows - 3]!.left;
    const y = pose.base - rows + 3;
    for (const [x, gy] of [
      [left + 1, y],
      [left + 2, y],
      [left + 1, y + 1],
    ] as const) {
      if (grid.get(x, gy) === "B") grid.put(x, gy, "L");
    }
  }
  const onBody = (x: number, y: number) => {
    const r = pose.base - y;
    return r >= 0 && r < rows && x >= spans[r]!.left && x <= spans[r]!.right;
  };
  // Floating, its shadow on the ground under it, narrower the higher it floats.
  const foot = spans[0];
  if (rigged.float > 0 && foot !== undefined) {
    const inset = 2 + rigged.float;
    for (let x = foot.left + inset; x <= foot.right - inset; x++)
      grid.put(x, rigged.base, RIG.shadow);
  }

  // Arms grow out of the sides in the body's colour, shaded beneath; a
  // strong one bulges over its upper arm, lit on top. The arms and the face
  // are marked: they come forward again over a wrap.
  const marks = new Grid(w, h);
  const draw = (x: number, y: number, role: string) => {
    grid.put(x, y, role);
    marks.put(x, y, role);
  };
  const hands = new Map<number, Point>();
  for (const arm of pose.arms) {
    const side = arm.side < 0 ? -1 : 1;
    const r = Math.min(top, Math.max(0, Math.trunc(arm.at * top)));
    const rootX = side < 0 ? spans[r]!.left + 1 : spans[r]!.right - 1;
    const rootY = pose.base - r;
    const reach = Math.max(Math.abs(arm.dx), Math.abs(arm.dy), 1);
    let hand: Point = { x: rootX, y: rootY };
    for (let k = 0; k <= round(reach); k++) {
      const f = k / reach;
      hand = { x: round(rootX + side * arm.dx * f), y: round(rootY + arm.dy * f) };
      draw(hand.x, hand.y, "B");
      draw(hand.x, hand.y + 1, "b");
      if (k > 0 && k < round(reach))
        for (let up = 1; up <= (arm.bulge ?? 0); up++)
          draw(hand.x, hand.y - up, up === arm.bulge ? "L" : "B");
    }
    draw(hand.x + side, hand.y, "B");
    draw(hand.x + side, hand.y + 1, "b");
    draw(hand.x, hand.y - 1, "B");
    hands.set(side, hand);
  }

  // The face: the eyes keep their size, part as the body widens, slide with
  // `face` and show only on the body.
  const er = round(9 * sy);
  const mr = round(5 * sy);
  const eyesAt = {
    x: column(er, pose.face) + pose.look.x,
    y: pose.base - er + 1 + pose.look.y,
  };
  const mouthAt = { x: column(mr, pose.face) + pose.look.x, y: pose.base - mr + pose.look.y };
  const eyes = eyesOf(pose.eyes);
  if (eyes !== undefined) {
    const apart = round(5.5 * (sx - 1));
    grid.stamp(eyes.art, eyes.hotspot, eyesAt, onBody, apart);
    marks.stamp(eyes.art, eyes.hotspot, eyesAt, onBody, apart);
  }
  const mouth = mouthOf(pose.mouth);
  if (mouth !== undefined) {
    grid.stamp(mouth.art, mouth.hotspot, mouthAt, onBody);
    marks.stamp(mouth.art, mouth.hotspot, mouthAt, onBody);
  }

  const at = (height: number): Point => {
    const r = Math.min(top, round(height * sy));
    return { x: column(r), y: pose.base - r };
  };
  const hr = Math.min(top, mr);
  let narrowed: Narrowed | undefined;
  // Narrower than at rest, what it wears is drawn in with it.
  if (sx < 1) {
    const byRow = new Map<number, readonly [number, number]>();
    spans.forEach((span, r) => {
      if (span.left <= span.right) byRow.set(pose.base - r, [span.left, span.right]);
    });
    narrowed = { spans: byRow, rest: REST_HALVES, heights: REST_HEIGHTS };
  }
  return {
    rows: grid.rows(),
    anchors: {
      headTop: { x: column(top) + pose.hatDX, y: crown(pose) },
      eyes: eyesAt,
      mouth: mouthAt,
      torso: at(3),
      handL: hands.get(-1) ?? { x: spans[hr]!.left - 1, y: pose.base - hr },
      handR: hands.get(1) ?? { x: spans[hr]!.right + 1, y: pose.base - hr },
      hold: at(2),
      ground: { x: column(0), y: pose.base + 1 },
      back: at(9),
    },
    front: [],
    features: grid.marked(marks),
    narrowed,
  };
}

/** The drawn miniature in `pose`, in whole cells: rows dropped or doubled for the squash, shifted for the lean, arms a cell thick. */
export function mini(pose: Pose): Body {
  const floor = MINI_FLOOR;
  const mid = anchorOf(MINI, "ground").x;
  const tall = MINI_TALL;
  const w = MINI.rows[0]!.length;
  const h = MINI.rows.length;
  const sy = Math.max(pose.sy, 0.25);
  const rows = Math.max(3, round(tall * sy));
  const top = rows - 1;
  /** Hero cells as whole miniature cells. */
  const cells = (px: number) => round(px / 2);
  const dx = Math.floor((pose.x - RIG.restX) / 2);
  const base = floor + Math.floor((pose.base - pose.float - RIG.restBase) / 2);
  const shift = (r: number) => dx + cells((pose.lean * r) / rows);

  const grid = new Grid(w, h);
  const spans: Span[] = [];
  for (let r = 0; r < rows; r++) {
    const t = (r + 0.5) / sy - 0.5;
    const source = MINI.rows[floor - Math.min(tall - 1, Math.max(0, round(t)))]!;
    const span = { left: Infinity, right: -Infinity };
    for (let x = 0; x < source.length; x++) {
      if (source[x] === ".") continue;
      grid.put(x + shift(r), base - r, source[x]!);
      span.left = Math.min(span.left, x + shift(r));
      span.right = Math.max(span.right, x + shift(r));
    }
    spans.push(span);
  }
  const onBody = (x: number, y: number) => {
    const r = base - y;
    return r >= 0 && r < rows && x >= spans[r]!.left && x <= spans[r]!.right;
  };

  // Arms a cell thick, out of the same side at the same height, with half
  // the hero's reach; the hand stays on the canvas.
  const marks = new Grid(w, h);
  const hands = new Map<number, Point>();
  for (const arm of pose.arms) {
    const side = arm.side < 0 ? -1 : 1;
    const r = Math.min(top, Math.max(0, Math.trunc(arm.at * top)));
    const span = spans[r]!;
    if (span.left > span.right) continue;
    const root = { x: side < 0 ? span.left : span.right, y: base - r };
    const reachX = cells(arm.dx);
    const reachY = cells(arm.dy);
    const reach = Math.max(Math.abs(reachX), Math.abs(reachY), 1);
    let hand: Point = root;
    for (let k = 1; k <= reach; k++) {
      const f = k / reach;
      hand = {
        x: Math.min(Math.max(root.x + side * round(reachX * f), 0), w - 1),
        y: root.y + round(reachY * f),
      };
      grid.put(hand.x, hand.y, "B");
      marks.put(hand.x, hand.y, "B");
    }
    hands.set(side, hand);
  }

  const er = round((floor - anchorOf(MINI, "eyes").y) * sy);
  const mr = round((floor - anchorOf(MINI, "mouth").y) * sy);
  // A glance of one hero cell still moves the miniature's eyes a cell.
  const look = { x: cells(pose.look.x), y: cells(pose.look.y) };
  const eyesAt = { x: mid + shift(er) + cells(pose.face) + look.x, y: base - er + look.y };
  const mouthAt = { x: mid + shift(mr) + cells(pose.face) + look.x, y: base - mr + look.y };
  const eyes = eyesOf(pose.eyes);
  if (eyes !== undefined) {
    const small = miniOf(eyes);
    grid.stamp(small.art, small.hotspot, eyesAt, onBody);
    marks.stamp(small.art, small.hotspot, eyesAt, onBody);
  }
  const mouth = mouthOf(pose.mouth);
  if (mouth !== undefined) {
    const small = miniOf(mouth);
    grid.stamp(small.art, small.hotspot, mouthAt, onBody);
    marks.stamp(small.art, small.hotspot, mouthAt, onBody);
  }

  const at = (anchor: Anchor): Point => {
    const r = Math.min(top, round((floor - anchorOf(MINI, anchor).y) * sy));
    return { x: mid + shift(r), y: base - r };
  };
  const hr = Math.min(top, round((floor - anchorOf(MINI, "handL").y) * sy));
  return {
    rows: grid.rows(),
    anchors: {
      headTop: { x: mid + shift(top) + cells(pose.hatDX), y: miniCrown(pose) },
      eyes: eyesAt,
      mouth: mouthAt,
      torso: at("torso"),
      handL: hands.get(-1) ?? { x: spans[hr]!.left, y: base - hr },
      handR: hands.get(1) ?? { x: spans[hr]!.right, y: base - hr },
      hold: at("hold"),
      ground: { x: mid + dx, y: base + 1 },
      back: at("back"),
    },
    front: [],
    features: grid.marked(marks),
  };
}

/** The eyes the rig stamps for a face name; none for the back of the head. */
const eyesOf = (name: string): Layer | undefined => (name === "none" ? undefined : EYES.get(name));
const mouthOf = (name: string): Layer | undefined =>
  name === "none" ? undefined : MOUTHS.get(name);

/**
 * `pose` held low enough that headwear reaching `headroom` rows above the
 * crown, and a back piece reaching `backroom` rows above its anchor (hero,
 * then miniature), stay on the canvas: the hat's lift gives way first, then
 * the float, then the hop, then the stretch.
 */
export function fitted(
  pose: Pose,
  headroom: { hero: number; mini: number } | undefined,
  backroom?: { hero: number; mini: number },
): Pose {
  const fit: { -readonly [K in keyof Pose]: Pose[K] } = { ...pose };
  const hatOff = () =>
    headroom !== undefined && (crown(fit) < headroom.hero || miniCrown(fit) < headroom.mini);
  const backOff = () =>
    backroom !== undefined &&
    (anchorOf(hero(fit), "back").y < backroom.hero ||
      anchorOf(mini(fit), "back").y < backroom.mini);
  while (hatOff() || backOff()) {
    if (fit.lift > 0 && hatOff()) fit.lift -= 1;
    else if (fit.float > 0) fit.float -= 1;
    else if (fit.base < RIG.restBase) fit.base += 1;
    else if (fit.sy > 1) fit.sy = Math.max(1, fit.sy - 1 / RIG.restRows);
    else break;
  }
  return fit;
}

/**
 * The body has no lap: a two-handed prop (on the hold) stands on its floor
 * in front of it. The hold drops or rises until the prop's last row is the
 * body's bottom row.
 */
export function seated<B extends Body>(body: B, held: Layer | undefined, compact: boolean): B {
  if (held === undefined || held.attach !== "hold") return body;
  const piece = compact ? miniOf(held) : held;
  const floor = anchorOf(body, "ground").y - 1;
  return {
    ...body,
    anchors: {
      ...body.anchors,
      hold: {
        x: anchorOf(body, "hold").x,
        y: floor - (piece.art.length - 1 - piece.hotspot.y),
      },
    },
  };
}
