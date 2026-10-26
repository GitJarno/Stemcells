// The pond, when every Cell has landed and nothing waits: Aski drips into a pond, swims as a
// gold koi, and a portrait rises from the stilled water to meet its eyes. Shapes are drawn on a
// 940 by 520 design stage (cells 4.8 by 9) and scaled to the stage it plays on. Glyphs come from
// a seeded hash per cell, so nothing churns: what changes, changes because something moved.

import { type Grid, makeGrid, put, type Stage } from "../grid.ts";
import { clamp, ease, hash, lerp, sstep } from "../math.ts";
import {
  CELL_ASPECT,
  cloudCells,
  type EyePlace,
  homeFit,
  region,
  type SceneCard,
  spell,
} from "../scene.ts";
import { PORTRAIT_COLS as PC, PORTRAIT, PORTRAIT_ROWS as PR } from "./pond-portrait.ts";
import { POND, SCENE_TIMES } from "./times.ts";

export { POND } from "./times.ts";

/** She is whole this long after `paint`: the last of her cells is in. */
const WHOLE = POND.paint + 0.3 + 2.6 + 0.25;
/** The design stage, in design units, and one of its cells (where a cell of the portrait's data is one cell). */
const DESIGN = { w: 940, h: 520, cw: 4.8, lh: 9 } as const;
/** The koi: its length, its half-width, and how long one figure of eight takes. On a stage of coarse cells it grows, to stay a fish. */
const KOI = { len: 210, half: 25, lap: 11, minRows: 1.6 } as const;
/** How much of the landscape behind her stays. */
const LIFT = 0.12;
/** Her eyes on the portrait's data grid (its cells' centres at +0.5: where the paint is darkest), and her face, where she rises from. */
const HER = {
  eyes: [
    [25.5, 11.5],
    [31, 11.4],
  ] as const,
  face: [28.5, 13] as const,
};

interface Ring {
  readonly x: number;
  readonly y: number;
  readonly t0: number;
  readonly amp: number;
}
interface Pad {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly notch: number;
}
/** A cell of the cloud: its home, its letter, and its moment: when it lets go, and (sooner) when it comes back. */
interface Drop {
  readonly i: number;
  readonly j: number;
  readonly ch: string;
  readonly d: number;
}

/** What the koi's swim needs: the stage and the cloud's middle, and the koi's length and half-width, all in design units. */
interface Swim {
  readonly W: number;
  readonly H: number;
  readonly cx: number;
  readonly len: number;
  readonly half: number;
}

interface Layout extends Swim {
  /** Design units per cell, across and down. */
  readonly px: number;
  readonly py: number;
  /** The ground, in design units. */
  readonly gy: number;
  /** The row whose foot is the ground line, and the cloud's height in rows. */
  readonly lineRow: number;
  readonly tall: number;
  readonly drops: readonly Drop[];
  readonly rings: readonly Ring[];
  readonly pads: readonly Pad[];
  /** Her, per cell of the stage: density 0..1 (-1 off her), the letter she spells there, and how far from her face (0..1). */
  readonly her: Float32Array;
  readonly herCh: readonly string[];
  readonly herFrom: Float32Array;
  readonly herEyes: EyePlace;
}

// ── Her ──────────────────────────────────────────────────────────────────────

/** The figure, a little lifted from its landscape: her head and her shoulders widening down. */
const figure = (c: number, r: number): number =>
  ((c - 29.5) / 10) ** 2 + ((r - 12) / 11.5) ** 2 < 1 ||
  (r >= 17 && Math.abs(c - 30) < lerp(9, 31, (r - 17) / 33))
    ? 1
    : 0;

/**
 * How much ink each cell of the portrait wants, 0..1: dark paint is dense, the
 * landscape behind her fades to a quarter, the levels spread by rank so every
 * glyph of the ramp is used, and her edges fade to nothing. Ink on a pale sky,
 * the reference renderer's.
 */
const DENSITY: Float32Array = (() => {
  const raw = new Float32Array(PC * PR);
  for (let r = 0; r < PR; r++)
    for (let c = 0; c < PC; c++) {
      let f = 0,
        n = 0;
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++) {
          const x = c + a,
            y = r + b;
          if (x >= 0 && x < PC && y >= 0 && y < PR) {
            f += figure(x, y);
            n++;
          }
        }
      raw[r * PC + c] = (1 - PORTRAIT[r * PC + c]!) * (LIFT + ((1 - LIFT) * f) / n);
    }
  const sorted = Float32Array.from(raw).sort(),
    top = sorted[sorted.length - 1]!;
  const rank = (v: number) => {
    let lo = 0,
      hi = sorted.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (sorted[m]! < v) lo = m + 1;
      else hi = m;
    }
    return lo / sorted.length;
  };
  // No frame: her edges fade out, the dress before it meets the bottom, the landscape before the sides.
  const fade = (c: number, r: number) =>
    1 -
    sstep(
      0.72,
      1,
      Math.hypot((c + 0.5 - PC / 2) / (PC / 2 + 1), (r + 0.5 - PR * 0.54) / (PR * 0.6)),
    );
  return raw.map(
    (v, k) => fade(k % PC, Math.floor(k / PC)) * (0.55 * rank(v) + (0.45 * v) / top) ** 1.35,
  );
})();

/** The density at a point of the portrait's data grid (cell centres at +0.5), smoothly between cells. */
function densityAt(c: number, r: number): number {
  const x = clamp(c - 0.5, 0, PC - 1),
    y = clamp(r - 0.5, 0, PR - 1),
    x0 = Math.min(Math.floor(x), PC - 2),
    y0 = Math.min(Math.floor(y), PR - 2),
    fx = x - x0,
    fy = y - y0;
  const at = (a: number, b: number) => DENSITY[b * PC + a]!;
  return lerp(
    lerp(at(x0, y0), at(x0 + 1, y0), fx),
    lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx),
    fy,
  );
}

/** Her glyph at a density, given the letter of her name the cell spells: capitals where the paint is dense, small letters, then the ramp's light marks. */
const herGlyph = (d: number, letter: string): string =>
  d > 0.68
    ? letter.toUpperCase()
    : d > 0.48
      ? letter
      : " .`-:;"[Math.min(5, Math.floor((d / 0.48) * 6))]!;

// ── The layout of a stage ────────────────────────────────────────────────────

function layout(seed: number, stage: Stage): Layout {
  const { cols, rows } = stage,
    fit = homeFit(stage);
  const z = Math.min(cols / DESIGN.w, rows / CELL_ASPECT / DESIGN.h),
    px = 1 / z,
    py = 1 / CELL_ASPECT / z;
  const W = cols * px,
    H = rows * py,
    cx = fit.cx * px,
    gy = fit.ground * py;
  const half = Math.max(KOI.half, KOI.minRows * py),
    len = (KOI.len * half) / KOI.half;
  const lineRow = clamp(Math.round(fit.ground) - 1, 0, rows - 1);

  // The cloud's letters, each dripping at its own moment: low ones first.
  const cells = cloudCells(stage, fit),
    letters = spell(cells, "aski");
  const top = Math.min(...cells.map((k) => Math.floor(k / cols))),
    tall = Math.max(1, lineRow + 1 - top);
  const drops = cells.map((k, n): Drop => {
    const i = k % cols,
      j = (k - i) / cols;
    return {
      i,
      j,
      ch: letters[n]!,
      d: hash(seed, i, j, 4) * 0.55 + (0.167 * (lineRow - j)) / tall,
    };
  });

  // Rings: the splash as the line opens, a few seeded drips landing in the opening
  // water, the koi surfacing, diving, rising and sinking, and its wake while it swims.
  const rings: Ring[] = [{ x: cx, y: gy, t0: POND.fill + 0.1, amp: 1.2 }];
  const late = drops.filter((p) => landing(p, lineRow, tall) >= POND.fill + 0.15);
  late
    .map((p) => [p, hash(seed, p.i, p.j, 6)] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .forEach(([p]) => {
      rings.push({ x: (p.i + 0.5) * px, y: gy, t0: landing(p, lineRow, tall), amp: 0.45 });
    });
  const L0: Swim = { W, H, cx, len, half };
  const at = (t: number) => path(L0, t, t);
  rings.push({ x: cx, y: H * 0.5, t0: POND.koi + 0.3, amp: 0.8 });
  rings.push({ ...xy(at(POND.dive)), t0: POND.dive, amp: 0.9 });
  rings.push({ ...xy(at(POND.rise - 0.1)), t0: POND.rise - 0.1, amp: 0.9 });
  rings.push({ x: cx, y: H * 0.5, t0: POND.paint + 0.1, amp: 1 });
  for (let t = POND.koi + 1; t < POND.paint; t += 1)
    if (koiDepth(t) < 0.4) rings.push({ ...xy(spine(L0, t)[18]!), t0: t, amp: 0.32 });

  const pads = (
    [
      [0.16, 0.24, 34, 1.1],
      [0.84, 0.3, 42, 3.9],
      [0.11, 0.78, 46, 5.2],
      [0.88, 0.8, 30, 2.4],
      [0.66, 0.1, 24, 0.3],
    ] as const
  ).map(([u, v, r, notch]) => ({ x: u * W, y: v * H, r, notch }));

  // Her, centred and lifted a cell, each of our cells averaging the paint under it.
  const left = W / 2 - (PC * DESIGN.cw) / 2,
    topY = H / 2 - (PR * DESIGN.lh) / 2 - DESIGN.lh;
  const toC = (x: number) => (x - left) / DESIGN.cw,
    toR = (y: number) => (y - topY) / DESIGN.lh;
  const mine = region(stage, (i, j) => {
    const c = toC((i + 0.5) * px),
      r = toR((j + 0.5) * py);
    return c >= 0 && c < PC && r >= 0 && r < PR;
  });
  const her = new Float32Array(cols * rows).fill(-1),
    herFrom = new Float32Array(cols * rows),
    herCh: string[] = [];
  const name = spell(mine, "monalisa"),
    fx = left + HER.face[0] * DESIGN.cw,
    fy = topY + HER.face[1] * DESIGN.lh;
  const reach = Math.hypot(PC * DESIGN.cw * 0.62, PR * DESIGN.lh * 0.75);
  // Each cell takes the paint under it, then is sharpened against its neighbours,
  // so her hair still frames her face when a cell covers several of the painting's.
  const soft = new Float32Array(cols * rows).fill(-1);
  for (const k of mine) {
    const i = k % cols,
      j = (k - i) / cols;
    let sum = 0;
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++)
        sum += densityAt(toC((i + (a + 0.5) / 4) * px), toR((j + (b + 0.5) / 4) * py));
    soft[k] = sum / 16;
  }
  const sharp = 1.4 * clamp(1 - DESIGN.cw / px, 0, 1); // none where a cell is one of the painting's
  mine.forEach((k, n) => {
    const i = k % cols,
      j = (k - i) / cols;
    let sum = 0,
      m = 0;
    for (let b = -1; b <= 1; b++)
      for (let a = -1; a <= 1; a++) {
        const v = soft[(j + b) * cols + i + a];
        if (i + a >= 0 && i + a < cols && v !== undefined && v >= 0) {
          sum += v;
          m++;
        }
      }
    her[k] = clamp(soft[k]! + sharp * (soft[k]! - sum / m), 0, 1);
    herCh[k] = herGlyph(her[k]!, name[n]!);
    herFrom[k] = clamp(Math.hypot((i + 0.5) * px - fx, (j + 0.5) * py - fy) / reach, 0, 1);
  });
  const onHer = ([c, r]: readonly [number, number]): [number, number] => [
    (left + c * DESIGN.cw) / px,
    (topY + r * DESIGN.lh) / py,
  ];
  const herEyes: EyePlace = {
    at: [onHer(HER.eyes[0]), onHer(HER.eyes[1])],
    rows: (2 * DESIGN.lh) / py,
  };
  return {
    px,
    py,
    W,
    H,
    cx,
    gy,
    len,
    half,
    lineRow,
    tall,
    drops,
    rings,
    pads,
    her,
    herCh,
    herFrom,
    herEyes,
  };
}

const xy = ([x, y]: readonly [number, number]) => ({ x, y });

/** How far a drip has fallen, in rows, `k` seconds after it lets go: the cloud's whole height in about 0.58 s. */
const fallen = (k: number, tall: number): number => tall * (k / 0.58) ** 2;
/** When a drip reaches the line. */
const landing = (p: Drop, lineRow: number, tall: number): number =>
  POND.drip + p.d + 0.58 * Math.sqrt(Math.max(0, lineRow - p.j) / tall);

// ── The koi ──────────────────────────────────────────────────────────────────

/**
 * Where the koi's head is at `tq`, on the swim as it stands at `now`: a figure of
 * eight across the pond, easing into a closing circle before she rises.
 */
function path(L: Swim, tq: number, now: number): [number, number] {
  const th = ((tq - POND.koi) / KOI.lap) * Math.PI * 2;
  const p8x = L.cx + L.W * 0.3 * Math.sin(th),
    p8y = L.H * 0.5 + L.H * 0.26 * Math.sin(2 * th);
  const b = sstep(POND.calm, POND.calm + 1.4, now);
  if (b <= 0) return [p8x, p8y];
  const r = lerp(L.H * 0.24, L.H * 0.04, sstep(POND.calm + 0.6, POND.paint + 0.3, now)),
    ph = th * 2.2;
  return [lerp(p8x, L.cx + r * 1.4 * Math.cos(ph), b), lerp(p8y, L.H * 0.5 + r * Math.sin(ph), b)];
}

/** The koi's spine at t, head first: where its head has been, walked back a body length, the tail swinging. */
function spine(L: Swim, t: number): [number, number][] {
  const pts = [path(L, t, t)];
  let tt = t;
  for (let k = 1; k <= 18; k++) {
    const q = pts[k - 1]!;
    let step = 0.05;
    for (let n = 0; n < 6; n++) {
      const p = path(L, tt - step, t),
        d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d > 0) step = clamp((step * (L.len / 18)) / d, 0.002, 0.4);
    }
    tt -= step;
    pts.push(path(L, tt, t));
  }
  return pts.map((p, k) => {
    if (k === 0) return p;
    const a = pts[k - 1]!,
      dx = a[0] - p[0],
      dy = a[1] - p[1],
      l = Math.hypot(dx, dy) || 1;
    const w = Math.sin(t * 7.5 - k * 0.42) * 6 * (L.half / KOI.half) * (k / 18) ** 1.6;
    return [p[0] - (dy / l) * w, p[1] + (dx / l) * w];
  });
}

/** How deep the koi is, 0 at the surface, 1 out of sight: it surfaces, dives, rises, and sinks as she comes. */
function koiDepth(t: number): number {
  if (t < POND.koi) return 1;
  const up = 1 - sstep(POND.koi, POND.koi + 1, t),
    down = sstep(POND.dive, POND.dive + 0.7, t) * (1 - sstep(POND.rise - 0.6, POND.rise, t));
  return clamp(Math.max(up, down, sstep(POND.paint - 0.1, POND.paint + 0.8, t)), 0, 1);
}

/** A stroke's character for a direction on screen (y down). */
function rayChar(a: number): string {
  a = ((a % Math.PI) + Math.PI) % Math.PI;
  return a < 0.39 || a > 2.75 ? "-" : a < 1.18 ? "\\" : a < 1.96 ? "|" : "/";
}

/**
 * The koi at design point (x, y) of cell (i, j): spelled `KOI` where its body is
 * thick, `koi` towards its edge, a `+` rim; fins and tail in strokes. Its letters
 * run across from its head, so it reads `koi` and its letters swim with it.
 */
function koiAt(
  S: readonly [number, number][],
  half: number,
  x: number,
  y: number,
  i: number,
  j: number,
  headCol: number,
  t: number,
  seed: number,
): { ch: string; edge: boolean } | null {
  let best = 1e9,
    along = 0,
    side = 0,
    head = 0;
  for (let k = 0; k < S.length - 1; k++) {
    const [ax, ay] = S[k]!,
      [bx, by] = S[k + 1]!,
      dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy || 1;
    const u = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1),
      qx = ax + u * dx,
      qy = ay + u * dy,
      d = Math.sqrt((x - qx) ** 2 + (y - qy) ** 2);
    if (d < best) {
      best = d;
      along = (k + u) / (S.length - 1);
      side = (x - qx) * dy - (y - qy) * dx < 0 ? -1 : 1;
      head = Math.atan2(-dy, -dx);
    }
  }
  const sn = along;
  // Round head, full shoulders, a long taper to the tail's root.
  const w =
    half *
    (sn < 0.14
      ? Math.sqrt(sn / 0.14) * 0.82 + 0.1
      : sn < 0.4
        ? lerp(0.92, 1, (sn - 0.14) / 0.26)
        : sn < 0.82
          ? lerp(1, 0.2, (sn - 0.4) / 0.42)
          : 0.2);
  const pec =
    sn > 0.18 && sn < 0.3 && best > w * 0.9 && best < w * lerp(1.55, 1.05, (sn - 0.18) / 0.12);
  const tf = (sn - 0.82) / 0.18,
    tail =
      sn >= 0.82 &&
      best < half * lerp(0.22, 0.78, tf) &&
      !(tf > 0.65 && best < half * (tf - 0.65) * 1.2);
  if (best > w && !pec && !tail) return null;
  if (pec)
    return hash(seed, i, j, 21) < 0.45 ? { ch: rayChar(head + side * 2.3), edge: true } : null;
  if (tail)
    return hash(seed, i, j, 22) < 0.5
      ? { ch: rayChar(head + ((side * best) / half) * 0.9 + Math.sin(t * 7) * 0.2), edge: true }
      : null;
  const r = best / w,
    n = (((i - headCol) % 3) + 3) % 3;
  return { ch: r < 0.55 ? "KOI"[n]! : r < 0.9 ? "koi"[n]! : "+", edge: false };
}

/** Its eyes, either side of its head, in cells. */
function koiEyes(L: Layout, S: readonly [number, number][]): EyePlace {
  const [hx, hy] = S[0]!,
    [nx, ny] = S[2]!,
    l = Math.hypot(hx - nx, hy - ny) || 1,
    ux = (hx - nx) / l,
    uy = (hy - ny) / l;
  const bx = hx - ux * L.len * 0.07,
    by = hy - uy * L.len * 0.07,
    w = L.half * 0.5;
  const a: [number, number] = [(bx - uy * w) / L.px, (by + ux * w) / L.py],
    b: [number, number] = [(bx + uy * w) / L.px, (by - ux * w) / L.py];
  return {
    at: a[0] <= b[0] ? [a, b] : [b, a],
    rows: (1.4 * DESIGN.lh * (L.half / KOI.half)) / L.py,
  };
}

// ── The water ────────────────────────────────────────────────────────────────

/** How much of the stage is pond at t, around the ground line, its shore swaying as it opens and closes. */
function waterMask(L: Layout, t: number, x: number, y: number): number {
  const open = sstep(POND.fill, POND.koi, t) * (1 - sstep(POND.drain, POND.cloud, t));
  if (open <= 0) return 0;
  const edge = Math.sin(x * 0.03 + t * 2) * 10 + Math.sin(x * 0.011 - t) * 14;
  const reach = open * (Math.max(L.gy, L.H - L.gy) + L.H * 0.04 + 40);
  return sstep(reach + 6, reach - 18, Math.abs(y - L.gy) + edge * open);
}

/**
 * The surface at (x, y): long strokes that sway, broken by a slow drift, and the
 * rings, which spread as flat ellipses. The strokes still once the water calms.
 * Returns the strength and, on a ring, its character.
 */
function water(
  L: Layout,
  live: readonly Ring[],
  t: number,
  x: number,
  y: number,
): [number, string | null] {
  const tn = Math.min(t, POND.calm + 1);
  const band = Math.sin(
    y * 0.1 + 2.4 * Math.sin(x * 0.0055 + tn * 0.32) + 0.9 * Math.sin(x * 0.016 - tn * 0.55),
  );
  const drift =
    0.5 +
    0.5 * Math.sin(x * 0.0042 - y * 0.009 + tn * 0.25) * Math.sin(x * 0.011 + y * 0.004 - tn * 0.4);
  let v = (Math.max(0, band - 0.55) / 0.45) * drift,
    ch: string | null = null;
  for (const r of live) {
    const age = t - r.t0,
      dx = x - r.x,
      dy = (y - r.y) * 1.8,
      d = Math.sqrt(dx * dx + dy * dy) || 1e-9,
      c = Math.abs(dx) / d;
    // A ring is one cell thick whichever way it runs: it neither breaks up nor doubles on coarse cells.
    if (Math.abs(d - age * 92) > 0.5 * (c * L.px + (Math.abs(dy) / d) * L.py * 1.8)) continue;
    const h = r.amp * 1.5 * Math.exp(-age / 1.25);
    if (h > v) {
      v = h;
      ch = c > 0.82 ? (dx < 0 ? "(" : ")") : c > 0.45 ? (dx * dy > 0 ? "/" : "\\") : "~";
    }
  }
  return [v, ch];
}

/** A lily pad at (x, y): its rim, its speckled leaf, or (in its notch) open water. Undefined off every pad. */
function padAt(
  L: Layout,
  x: number,
  y: number,
  i: number,
  j: number,
  seed: number,
): string | null | undefined {
  for (const p of L.pads) {
    const dx = x - p.x,
      dy = (y - p.y) * 1.7;
    if (Math.abs(dx) > p.r || Math.abs(dy) > p.r) continue;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > p.r) continue;
    let a = Math.atan2(dy, dx) - p.notch;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) < 0.32 && d > p.r * 0.25) return null;
    const c = Math.abs(dx) / (d || 1),
      rim = 0.5 * (c * L.px + (Math.abs(dy) / (d || 1)) * L.py * 1.7); // one cell
    if (d > p.r - rim) {
      const an = Math.atan2(dy, dx);
      return Math.abs(an) < 0.6 ? ")" : Math.abs(an) > 2.5 ? "(" : an > 0 ? "_" : "-";
    }
    return hash(seed, i, j, 31) < 0.35 ? ":" : ".";
  }
  return undefined;
}

// ── The eyes ─────────────────────────────────────────────────────────────────

/** Where the eyes are and how open: at home, on the koi, on her, or (mid-change) nowhere. */
function eyeState(t: number): { open: number; on: "home" | "koi" | "her" | null } {
  if (t < POND.drip) return { open: 1, on: "home" };
  if (t >= POND.end) return { open: 1, on: "home" };
  const opening = (a: number) => 0.06 + 0.94 * ease.inOutCubic(sstep(a, a + 0.35, t));
  if (t >= POND.cloud + 0.9) return { open: opening(POND.cloud + 0.9), on: "home" };
  if (t >= WHOLE && t < POND.back) {
    // Settled on her once she is whole; one blink, then shut as she goes.
    const u = (t - (POND.say + 1.6)) / 0.24,
      blink = u > 0 && u < 1 ? 1 - 0.93 * Math.sin(u * Math.PI) : 1;
    return {
      open: Math.min(opening(WHOLE), blink, 1 - sstep(POND.back - 0.35, POND.back, t)),
      on: "her",
    };
  }
  if (t >= POND.koi + 0.7 && t < POND.calm + 0.2) {
    // The koi's while it swims at the surface: they shut as it dives and open as it rises.
    const open =
      sstep(POND.koi + 0.7, POND.koi + 1.05, t) *
      (1 - sstep(POND.calm - 0.15, POND.calm + 0.2, t)) *
      (1 - sstep(0.12, 0.3, koiDepth(t)));
    return { open, on: open > 0 ? "koi" : null };
  }
  return { open: 0, on: null };
}

// ── The scene ────────────────────────────────────────────────────────────────

export function thePond(seed = 7): SceneCard {
  const layouts = new Map<string, Layout>(); // derived from (seed, stage) alone, so keeping them changes no frame
  const layoutFor = (s: Stage) => {
    const key = `${s.cols}x${s.rows}`;
    let l = layouts.get(key);
    if (!l) {
      l = layout(seed, s);
      layouts.set(key, l);
    }
    return l;
  };

  function frame(t: number, stage: Stage): Grid {
    const L = layoutFor(stage),
      g = makeGrid(stage),
      { cols, rows } = stage;
    const depth = koiDepth(t),
      S = t > POND.koi - 0.2 && t < POND.paint + 1 && depth < 0.98 ? spine(L, t) : null;
    let kx0 = Infinity,
      kx1 = -Infinity,
      ky0 = Infinity,
      ky1 = -Infinity;
    if (S)
      for (const [x, y] of S) {
        kx0 = Math.min(kx0, x);
        kx1 = Math.max(kx1, x);
        ky0 = Math.min(ky0, y);
        ky1 = Math.max(ky1, y);
      }
    const headCol = S ? Math.floor(S[0]![0] / L.px) : 0,
      pad = L.half * 1.6;
    const live = L.rings.filter((r) => t >= r.t0 && t - r.t0 <= 3.2);
    // The pond gives way to her, and comes back when she goes.
    const pond =
      1 - sstep(POND.paint + 0.6, POND.paint + 3, t) * (1 - sstep(POND.back, POND.back + 1.2, t));

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i,
          x = (i + 0.5) * L.px,
          y = (j + 0.5) * L.py;
        // She rises from her face outwards, each letter turning over where the
        // pond fades; she goes the same way, her face last.
        let shown = 0;
        if (L.her[k]! >= 0 && t >= POND.paint) {
          const d = L.herFrom[k]!;
          const due = POND.paint + 0.3 + 2.6 * d ** 0.8 + hash(seed, i, j, 1) * 0.25,
            gone = POND.back + 0.2 + 1.1 * (1 - d) ** 0.8 + hash(seed, i, j, 2) * 0.2;
          shown =
            sstep(Math.max(due - 1, POND.paint), due, t) * (1 - sstep(gone - 0.5, gone + 0.5, t));
          // A cell of her with no mark claims nothing: the water under it just fades.
          if (shown > 0 && shown >= 0.15 + 0.7 * hash(seed, i, j, 3) && L.herCh[k] !== " ") {
            put(g, i, j, L.herCh[k]!, (0.22 + 0.78 * L.her[k]! ** 0.8) * shown);
            continue;
          }
        }
        // The water: pads and strokes and rings, lighter than the things in it.
        const m = waterMask(L, t, x, y) * pond * (1 - shown);
        if (m > 0.01) {
          const leaf = padAt(L, x, y, i, j, seed);
          if (leaf) put(g, i, j, leaf, 0.5 * m);
          else {
            const [a, rc] = water(L, live, t, x, y);
            if (a >= 0.18 && (rc || a >= 0.5 || hash(seed, i, j, 5) >= 0.55)) {
              const ch =
                rc ?? (a > 0.85 ? "~" : a > 0.55 ? "pond"[(i + j * 3) % 4]! : a > 0.35 ? "-" : ".");
              put(g, i, j, ch, (0.16 + 0.4 * clamp(a, 0, 1.2)) * m);
            }
          }
        }
        // The koi, gold: on the surface it covers the water; below, the water's glyphs cover it.
        if (S && x > kx0 - pad && x < kx1 + pad && y > ky0 - pad && y < ky1 + pad) {
          const f = koiAt(S, L.half, x, y, i, j, headCol, t, seed);
          if (f) {
            const under = g.cells[k]!.ink > 0;
            if (depth > 0.55) {
              if (!under && hash(seed, i, j, 23) < 0.35)
                put(g, i, j, ".", 0.25 * (1 - depth), "warm");
            } else if (depth > 0.3) {
              if (!under)
                put(g, i, j, f.edge ? "." : "*", (1 - depth) * (f.edge ? 0.7 : 1), "warm");
            } else put(g, i, j, f.ch, (1 - depth) * (f.edge ? 0.7 : 1), "warm");
          }
        }
      }
    }

    // The ground line Aski stands on: it comes as the cloud drips, opens into the
    // pond, takes the pond back as it drains, and goes once the cloud is home.
    const line =
      sstep(POND.drip - 0.25, POND.drip + 0.05, t) * (1 - sstep(POND.fill, POND.fill + 0.6, t)) +
      sstep(POND.drain, POND.cloud, t) * (1 - sstep(POND.cloud + 0.7, POND.home, t));
    if (line > 0)
      for (let i = 0; i < cols; i++)
        if (
          Math.abs((i + 0.5) * L.px - L.cx) < L.W * 0.3 &&
          !(g.cells[L.lineRow * cols + i]!.ink > 0)
        )
          put(g, i, L.lineRow, "_", 0.35 * line);

    // Aski's letters: at rest, falling into the line, rising out of it, and home.
    for (const p of L.drops) {
      if (t < POND.drip + p.d) {
        put(g, p.i, p.j, p.ch, 1);
        continue;
      }
      const back = (t - POND.cloud + 0.1 - p.d * 0.6) / 0.55;
      if (back >= 1) {
        put(g, p.i, p.j, p.ch, 1);
        continue;
      }
      if (back > 0) {
        put(g, p.i, Math.round(lerp(L.lineRow, p.j, ease.inOutCubic(back))), p.ch, 1);
        continue;
      }
      const row = p.j + fallen(t - POND.drip - p.d, L.tall);
      if (t < POND.fill + 1.2 && row < L.lineRow + 0.5) put(g, p.i, Math.round(row), p.ch, 1);
    }
    return g;
  }

  return {
    id: "the-pond",
    seed,
    beats: {
      drip: POND.drip,
      pond: POND.fill,
      koi: POND.koi,
      dive: POND.dive,
      rise: POND.rise,
      calm: POND.calm,
      portrait: POND.paint,
      say: POND.say,
      back: POND.back,
      home: POND.home,
    },
    end: POND.end,
    still: SCENE_TIMES["the-pond"]!.still,
    lines: [SCENE_TIMES["the-pond"]!.line],
    home: true,
    eyes: (t) => eyeState(t).open,
    eyesAt: (t, stage) => {
      const { on } = eyeState(t);
      if (on === "her") return layoutFor(stage).herEyes;
      if (on === "koi") {
        const L = layoutFor(stage);
        return koiEyes(L, spine(L, t));
      }
      return null;
    },
    frame,
  };
}
