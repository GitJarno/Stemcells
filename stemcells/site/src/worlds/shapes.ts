// The pages a Cell draws in its answers, as shapes of one field of points: every search it
// measured as a landscape, before and after; a query's way through the new system; the codebase
// as a galaxy with what changed alight; and the page it would build, in layers, then whole.

import { clamp, hash, lerp } from "../kit/form.ts";
import type { Eye, Lines, Pen, Rgb, Shape, Sheet, Vec } from "./stage.ts";

export type PageName = "queries" | "flow" | "code" | "page";

const INK: Rgb = [245 / 255, 245 / 255, 245 / 255];
const BLUE: Rgb = [0.42, 0.5, 1];
const VIOLET: Rgb = [0.66, 0.42, 1];
const HOT: Rgb = [1, 0.44, 0.18];
const SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
const MUTED = "rgba(245,245,245,.62)";

const mixed = (a: Rgb, b: Rgb, u: number): Rgb => [
  lerp(a[0], b[0], u),
  lerp(a[1], b[1], u),
  lerp(a[2], b[2], u),
];
/** A value along stops of [at, value], straight between them. */
function along(stops: readonly (readonly [number, number])[], at: number): number {
  const next = stops.findIndex(([x]) => x >= at);
  if (next <= 0) return next === 0 ? stops[0]![1] : stops.at(-1)![1];
  const [x0, y0] = stops[next - 1]!,
    [x1, y1] = stops[next]!;
  return lerp(y0, y1, (at - x0) / (x1 - x0));
}
/** A steady bell-shaped number round 0. */
const bell = (n: number, seed: number): number =>
  (hash(n, seed) + hash(n, seed + 1) + hash(n, seed + 2) - 1.5) / 1.5;
/** The same direction for the same point every time, anywhere on a ball. */
function onBall(n: number, seed: number): Vec {
  const z = hash(n, seed) * 2 - 1,
    turn = hash(n, seed + 5) * Math.PI * 2,
    r = Math.sqrt(1 - z * z);
  return [r * Math.cos(turn), z, r * Math.sin(turn)];
}

class Field {
  readonly pos: Float32Array;
  readonly ink: Float32Array;
  constructor(count: number) {
    this.pos = new Float32Array(count * 3);
    this.ink = new Float32Array(count * 4);
  }
  put(
    n: number,
    x: number,
    y: number,
    z: number,
    [r, g, b]: Rgb,
    light: number,
    size: number,
  ): void {
    this.pos.set([x, y, z], n * 3);
    this.ink.set([r * light, g * light, b * light, size], n * 4);
  }
}
class Strokes {
  readonly #pos: number[] = [];
  readonly #ink: number[] = [];
  line(a: Vec, b: Vec, ink: Rgb, from: number, to = from): void {
    this.#pos.push(...a, ...b);
    this.#ink.push(...ink, from, ...ink, to);
  }
  done(): Lines {
    return { pos: new Float32Array(this.#pos), ink: new Float32Array(this.#ink) };
  }
}

function text(
  { ctx }: Pen,
  words: string,
  x: number,
  y: number,
  size: number,
  color = "#f5f5f5",
  weight = 400,
  align: CanvasTextAlign = "left",
): void {
  ctx.font = `${weight} ${size}px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(words, x, y);
}
/** A name beside a place in the shape, on a short line up from it. */
function tag(
  pen: Pen,
  at: Vec,
  name: string,
  more = "",
  up = 26,
  align: CanvasTextAlign = "center",
): void {
  const { ctx, frame } = pen;
  const [x, y] = pen.place(at);
  const size = pen.narrow ? 11 : 12.5;
  const wide = (words: string, weight: number) => {
    ctx.font = `${weight} ${size}px ${SANS}`;
    return ctx.measureText(words).width;
  };
  const half = Math.max(wide(name, 600), more === "" ? 0 : wide(more, 400)) / 2 + 4;
  const left = align === "center" ? half : 4,
    right = align === "center" ? half : half * 2;
  const tx = clamp(x, frame.x + left, frame.x + frame.w - right);
  ctx.strokeStyle = "rgba(245,245,245,.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  // `up` below zero hangs the name under the place.
  ctx.moveTo(x, y - Math.sign(up) * 4);
  ctx.lineTo(x, up > 0 ? y - up + 5 : y - up - size - 1);
  ctx.stroke();
  const second = more === "" ? 0 : size + 4;
  const ny = up > 0 ? y - up - second : y - up;
  text(pen, name, tx, ny, size, "#f5f5f5", 600, align);
  if (more !== "") text(pen, more, tx, ny + second, size, MUTED, 400, align);
}

// ── Every search it measured ────────────────────────────────────────────────
const ACROSS = 50,
  DEEP = 40;
export const QUERIES = ACROSS * DEEP;
const SPREAD = 2.5,
  DEPTH = 2,
  TALL = 1.4 / 640;
/** How hot a search that took `ms` is: a quick one blue, a slow one orange to white. */
function heat(ms: number): Rgb {
  const u = along(
    [
      [0, 0],
      [45, 0.16],
      [120, 0.38],
      [310, 0.7],
      [540, 0.92],
      [640, 1],
    ],
    ms,
  );
  if (u < 0.38) return mixed([0.26, 0.34, 0.95], [0.5, 0.36, 1], u / 0.38);
  if (u < 0.7) return mixed([0.5, 0.36, 1], [0.98, 0.3, 0.62], (u - 0.38) / 0.32);
  if (u < 0.92) return mixed([0.98, 0.3, 0.62], [1, 0.46, 0.22], (u - 0.7) / 0.22);
  return mixed([1, 0.46, 0.22], [1, 0.82, 0.7], (u - 0.92) / 0.08);
}
const place = (n: number): readonly [number, number] => [
  ((n % ACROSS) / (ACROSS - 1) - 0.5) * SPREAD,
  (Math.floor(n / ACROSS) / (DEEP - 1) - 0.5) * DEPTH,
];
/** The eight searches with a typo: the index holds exact words, so they still go the old way. */
const TYPOS = new Set([408, 617, 1033, 1189, 1342, 1424, 1571, 1686]);

/** How long each search took, before and after: ranked by where it lies among its like, at the percentiles the Cell measured. */
function measured(): readonly { readonly before: number; readonly after: number }[] {
  const hills: readonly (readonly [number, number, number, number])[] = [
    [-0.62, -0.25, 0.26, 0.84],
    [0.18, -0.5, 0.3, 0.86],
    [0.8, -0.12, 0.24, 1.04],
    [-0.1, 0.35, 0.3, 0.5],
    [-1.0, 0.45, 0.24, 0.55],
    [0.5, 0.6, 0.24, 0.42],
  ];
  const rise = Array.from({ length: QUERIES }, (_, n) => {
    const [x, z] = place(n);
    let up = 0.05 * hash(n, 11);
    for (const [hx, hz, r, h] of hills)
      up += h * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (2 * r * r));
    return up + 0.07 * Math.sin(x * 9 + z * 4) * Math.sin(z * 11 - x * 3);
  });
  const order = rise.map((_, n) => n).sort((a, b) => rise[a]! - rise[b]!);
  const rank = new Float32Array(QUERIES);
  order.forEach((n, at) => (rank[n] = at / (QUERIES - 1)));
  // The order after: repeats first (the cache has them), then the rest as they were, and the typos last.
  const cached = order.filter((n) => !TYPOS.has(n) && hash(n, 23) < 0.382);
  const indexed = order.filter((n) => !TYPOS.has(n) && hash(n, 23) >= 0.382);
  const later = new Float32Array(QUERIES);
  [...cached, ...indexed].forEach((n, at) => (later[n] = at / (QUERIES - 1)));
  return Array.from({ length: QUERIES }, (_, n) => ({
    before: along(
      [
        [0, 28],
        [0.2, 60],
        [0.5, 120],
        [0.8, 205],
        [0.95, 310],
        [0.99, 540],
        [1, 640],
      ],
      rank[n]!,
    ),
    after: TYPOS.has(n)
      ? 285 + 35 * hash(n, 3)
      : along(
          [
            [0, 1],
            [0.38, 2],
            [0.45, 12],
            [0.5, 18],
            [0.95, 45],
            [0.99, 80],
            [1, 92],
          ],
          later[n]!,
        ),
  }));
}

const LAND: Eye = { yaw: -0.42, pitch: 0.33, far: 3.95, at: [0, 0.35, 0], sway: 0.1 };

function land(count: number, now: "before" | "after"): Shape {
  const field = new Field(count);
  const took = measured();
  const each = Math.floor(count / QUERIES);
  for (let n = 0; n < count; n++) {
    const q = n % QUERIES;
    const step = Math.min(each - 1, Math.floor(n / QUERIES));
    const ms = took[q]![now];
    const [x, z] = place(q);
    // Each search is a column: its points from the floor to its top, the top the brightest.
    const u = each === 1 ? 1 : 1 - step / (each - 1);
    const typo = now === "after" && TYPOS.has(q);
    const tip = u === 1;
    field.put(
      n,
      x,
      ms * TALL * u,
      z,
      typo ? HOT : heat(ms * lerp(0.35, 1, u)),
      typo ? lerp(0.5, 1, u) : tip ? (now === "after" ? 0.95 : 0.9) : lerp(0.1, 0.36, u * u),
      typo ? (tip ? 5 : 2.4) : tip ? 2.5 : 1.5,
    );
  }
  const strokes = new Strokes();
  const top = (q: number): Vec => [place(q)[0], took[q]![now] * TALL, place(q)[1]];
  for (let q = 0; q < QUERIES; q++) {
    // Ridges along the land, so its slopes read as one surface. A typo's spire stands out of it alone.
    const ink = heat(took[q]![now]);
    const alone = (other: number) => now === "after" && (TYPOS.has(q) || TYPOS.has(other));
    if (q % ACROSS < ACROSS - 1)
      strokes.line(top(q), alone(q + 1) ? top(q) : top(q + 1), ink, now === "after" ? 0.2 : 0.34);
    else strokes.line(top(q), top(q), ink, 0);
    if (q < QUERIES - ACROSS)
      strokes.line(
        top(q),
        alone(q + ACROSS) ? top(q) : top(q + ACROSS),
        ink,
        now === "after" ? 0.1 : 0.13,
      );
    else strokes.line(top(q), top(q), ink, 0);
  }
  // The land as it was stays over the land as it is, a ghost.
  const was = (q: number): Vec => [place(q)[0], took[q]!.before * TALL, place(q)[1]];
  for (let q = 0; q < QUERIES; q++) {
    const beside = q % ACROSS < ACROSS - 1 ? q + 1 : q;
    strokes.line(was(q), was(beside), heat(took[q]!.before), now === "after" ? 0.13 : 0);
  }
  const peak = took.reduce((best, each, q) => (each.before > took[best]!.before ? q : best), 0);
  const spire = 1189;
  return {
    pos: field.pos,
    ink: field.ink,
    eye: LAND,
    family: "land",
    lines: strokes.done(),
    label(pen) {
      const { frame, narrow } = pen;
      const big = narrow ? 34 : 46;
      const x = frame.x + 6,
        y = frame.y + big;
      // The number counts down as the land falls.
      const ms = now === "before" ? Math.round(lerp(120, 18, clamp(pen.along * 2))) : 18;
      text(pen, `${ms} ms`, x, y, big, "#f5f5f5", 650);
      text(
        pen,
        narrow ? "half are faster than this" : "half of all searches are faster than this",
        x + 2,
        y + 20,
        narrow ? 11 : 12.5,
        MUTED,
      );
      text(
        pen,
        narrow ? "2,000 searches" : "2,000 searches, each a column as tall as it took",
        frame.x + frame.w - 6,
        frame.y + frame.h - 10,
        narrow ? 11 : 12,
        MUTED,
        400,
        "right",
      );
      pen.ctx.globalAlpha *= clamp(1 - Math.abs(pen.along) * 4);
      if (now === "before") tag(pen, top(peak), "over 540 ms", "the slowest 1%", 14);
      else tag(pen, top(spire), "8 typos", "still go the old way", 22);
    },
  };
}

// ── How a query travels ─────────────────────────────────────────────────────
const NODE = {
  ask: [-1.5, 0, 0.1],
  cache: [-0.55, 0, 0],
  index: [0.42, -0.02, -0.4],
  scan: [0.45, -0.42, 0.62],
  answer: [1.5, 0.02, 0.05],
} as const satisfies Record<string, Vec>;
const FLOW: Eye = { yaw: -0.26, pitch: 0.3, far: 4.15, at: [0, 0.02, 0], sway: 0.14 };
/** A route as many small steps along smooth arcs through its stops, each arc lifted at its middle. */
function route(stops: readonly (readonly [Vec, number])[]): Float32Array {
  const STEPS = 96;
  const out = new Float32Array((STEPS + 1) * 3);
  for (let s = 0; s <= STEPS; s++) {
    const u = (s / STEPS) * (stops.length - 1);
    const n = Math.min(stops.length - 2, Math.floor(u));
    const [a] = stops[n]!,
      [b, lift] = stops[n + 1]!;
    const t = u - n,
      e = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
    out.set(
      [
        lerp(a[0], b[0], e),
        lerp(a[1], b[1], e) + Math.sin(Math.PI * t) * lift,
        lerp(a[2], b[2], e),
      ],
      s * 3,
    );
  }
  return out;
}
function flow(count: number): Shape {
  const field = new Field(count);
  const routes = [
    {
      way: route([
        [NODE.ask, 0],
        [NODE.cache, 0.1],
        [NODE.answer, 0.95],
      ]),
      ink: BLUE,
      share: 0.38,
      pace: 0.3,
      wide: 0.075,
    },
    {
      way: route([
        [NODE.ask, 0],
        [NODE.cache, 0.1],
        [NODE.index, 0.06],
        [NODE.answer, 0.06],
      ]),
      ink: VIOLET,
      share: 0.616,
      pace: 0.17,
      wide: 0.085,
    },
    {
      way: route([
        [NODE.ask, 0],
        [NODE.cache, 0.1],
        [NODE.scan, -0.1],
        [NODE.answer, -0.22],
      ]),
      ink: HOT,
      share: 0.004,
      pace: 0.035,
      wide: 0.02,
    },
  ];
  const moving = Math.floor(count * 0.62);
  const rides = Array.from({ length: moving }, (_, n) => {
    // Every thousandth point is dealt to the routes in their true shares.
    const deal = (((n * 0.754877) % 1) + 1) % 1;
    const which = deal < 0.004 ? 2 : deal < 0.384 ? 0 : 1;
    const [x, y, z] = onBall(n, 2);
    const r = Math.sqrt(hash(n, 9)) * routes[which]!.wide;
    return {
      which,
      phase: hash(n, 4),
      off: [x * r, y * r, z * r] as const,
      pace: 0.85 + 0.3 * hash(n, 6),
    };
  });
  rides.forEach(({ which }, n) =>
    field.put(
      n,
      0,
      0,
      0,
      routes[which]!.ink,
      which === 2 ? 1 : 0.3 + 0.5 * hash(n, 8) ** 3,
      which === 2 ? 3.6 : 1.5 + hash(n, 7),
    ),
  );
  for (let n = moving; n < count; n++) {
    const u = (n - moving) / (count - moving);
    if (u < 0.12) {
      const [x, y, z] = onBall(n, 3);
      const at = u < 0.06 ? NODE.ask : NODE.answer;
      const r = 0.15 * (0.6 + 0.4 * hash(n, 5));
      field.put(n, at[0] + x * r, at[1] + y * r, at[2] + z * r, INK, 0.4, 1.5);
    } else if (u < 0.32) {
      // The cache is a ring every query passes through.
      const around = hash(n, 12) * Math.PI * 2,
        tube = hash(n, 13) * Math.PI * 2,
        r = 0.31 + 0.035 * Math.cos(tube);
      field.put(
        n,
        NODE.cache[0] + 0.035 * Math.sin(tube),
        NODE.cache[1] + r * Math.cos(around),
        NODE.cache[2] + r * Math.sin(around),
        BLUE,
        0.62,
        1.6,
      );
    } else if (u < 0.78) {
      // The index is a lattice: everything already in its place.
      const cell = Math.floor(hash(n, 14) * 9 ** 3);
      const spot = (v: number) => (v / 8 - 0.5) * 0.52;
      const edge = [cell % 9, Math.floor(cell / 9) % 9, Math.floor(cell / 81)] as const;
      const rim = edge.filter((v) => v === 0 || v === 8).length;
      const j = (s: number) => bell(n, s) * 0.008;
      field.put(
        n,
        NODE.index[0] + spot(edge[0]) + j(20),
        NODE.index[1] + spot(edge[1]) + j(24),
        NODE.index[2] + spot(edge[2]) + j(28),
        VIOLET,
        rim > 1 ? 0.6 : 0.16,
        rim > 1 ? 1.8 : 1.5,
      );
    } else {
      // The old scan is every page, read one after another.
      const sheet = Math.floor(hash(n, 15) * 14);
      const e = hash(n, 16) < 0.5;
      const side = hash(n, 17),
        v = e ? side : Math.round(side),
        w = e ? Math.round(hash(n, 18)) : hash(n, 18);
      field.put(
        n,
        NODE.scan[0] + (sheet / 13 - 0.5) * 0.7,
        NODE.scan[1] + (v - 0.5) * 0.3,
        NODE.scan[2] + (w - 0.5) * 0.3,
        HOT,
        0.22,
        1.4,
      );
    }
  }
  return {
    pos: field.pos,
    ink: field.ink,
    eye: FLOW,
    tick(time) {
      for (let n = 0; n < moving; n++) {
        const { which, phase, off, pace } = rides[n]!;
        const { way, pace: speed } = routes[which]!;
        const u = ((phase + time * speed * pace) % 1) * 96;
        const s = Math.floor(u),
          t = u - s,
          i = s * 3,
          o = n * 3;
        // It narrows into each end.
        const tight = Math.min(1, u / 10, (96 - u) / 10);
        field.pos[o] = lerp(way[i]!, way[i + 3]!, t) + off[0] * tight;
        field.pos[o + 1] = lerp(way[i + 1]!, way[i + 4]!, t) + off[1] * tight;
        field.pos[o + 2] = lerp(way[i + 2]!, way[i + 5]!, t) + off[2] * tight;
      }
    },
    label(pen) {
      tag(pen, [NODE.ask[0], 0.18, NODE.ask[2]], "A search", "", 18);
      tag(
        pen,
        [0.5, 1.02, 0],
        pen.narrow ? "38% repeats" : "38% are repeats",
        pen.narrow ? "under 2 ms" : "the cache answers in under 2 ms",
        14,
      );
      tag(pen, [NODE.cache[0], -0.36, 0], "Cache", "", -24);
      tag(
        pen,
        [NODE.index[0], NODE.index[1] + 0.3, NODE.index[2]],
        "Index",
        pen.narrow ? "62%" : "62%, about 18 ms",
        14,
      );
      tag(
        pen,
        [NODE.scan[0], NODE.scan[1] - 0.26, NODE.scan[2]],
        "Old scan",
        pen.narrow ? "8 typos" : "8 typos in 2,000, 300 ms",
        -34,
      );
      tag(pen, [NODE.answer[0], 0.2, NODE.answer[2]], "Answer", "", 18);
    },
  };
}

// ── What it touched ─────────────────────────────────────────────────────────
const GALAXY: Eye = { yaw: 0.16, pitch: 0.74, far: 3.95, at: [0, 0.08, 0], sway: 0.16 };
const FOLDERS = [
  { name: "search", files: 24, at: [0, 0.12, 0], ink: HOT },
  { name: "pages", files: 64, at: [1.25, 0, -0.35], ink: BLUE },
  { name: "components", files: 92, at: [0.42, -0.08, -1.12], ink: VIOLET },
  { name: "api", files: 42, at: [-0.75, 0.05, -0.95], ink: BLUE },
  { name: "cart", files: 36, at: [-1.35, -0.06, -0.1], ink: VIOLET },
  { name: "lib", files: 50, at: [-0.75, 0.02, 0.85], ink: BLUE },
  { name: "tests", files: 58, at: [0.65, -0.04, 0.9], ink: VIOLET },
] as const;
/** The nine files that changed: [folder, file in it]. */
const CHANGED = [
  [0, 0],
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 5],
  [0, 8],
  [0, 12],
  [3, 2],
  [6, 4],
] as const satisfies readonly (readonly [number, number])[];
function code(count: number): Shape {
  const field = new Field(count);
  const files = FOLDERS.flatMap((folder, f) =>
    Array.from({ length: folder.files }, (_, n) => {
      const turn = n * 2.39996,
        r = 0.056 * Math.sqrt(n + 0.6);
      const lit = CHANGED.some(([cf, cn]) => cf === f && cn === n);
      const at: Vec = [
        folder.at[0] + r * Math.cos(turn),
        folder.at[1] + bell(n, 40 + f) * 0.07 + (lit ? 0.1 + 0.16 * hash(n, 60) : 0),
        folder.at[2] + r * Math.sin(turn),
      ];
      return { at, f, n, lit, mass: (lit ? 5 : 1) * (0.25 + hash(n, 50 + f) ** 2 * 1.5) };
    }),
  );
  const heavy = files.reduce((sum, file) => sum + file.mass, 0);
  let n = 0;
  const main = Math.floor(count * 0.8);
  files.forEach((file, at) => {
    const last = at === files.length - 1;
    const take = last
      ? main - n
      : Math.min(main - n, Math.max(6, Math.round((file.mass / heavy) * main)));
    const r = (file.lit ? 0.04 : 0.02) * Math.cbrt(0.4 + file.mass / (file.lit ? 5 : 1));
    for (let p = 0; p < take; p++, n++) {
      const [x, y, z] = onBall(n, 31);
      const deep = r * (0.75 + 0.25 * hash(n, 33));
      const halo = file.lit && p % 4 === 0 ? 1.4 + hash(n, 35) * 1.6 : 1;
      field.put(
        n,
        file.at[0] + x * deep * halo,
        file.at[1] + y * deep * halo,
        file.at[2] + z * deep * halo,
        file.lit
          ? mixed(HOT, [1, 0.74, 0.55], hash(n, 36))
          : mixed(FOLDERS[file.f]!.ink, INK, 0.12),
        file.lit ? (halo > 1 ? 0.16 : 0.42) : 0.26,
        1.5,
      );
    }
  });
  // Dust between the folders.
  for (; n < count; n++) {
    const r = 0.25 + 1.75 * hash(n, 72) ** 0.8,
      turn = Math.floor(hash(n, 71) * 3) * 2.0944 + r * 1.9 + bell(n, 74) * 0.5;
    field.put(n, Math.cos(turn) * r, bell(n, 73) * 0.08, Math.sin(turn) * r * 0.9, BLUE, 0.3, 1.5);
  }
  const strokes = new Strokes();
  const arc = (a: Vec, b: Vec, ink: Rgb, light: number, lift: number) => {
    const at = (u: number): Vec => [
      lerp(a[0], b[0], u),
      lerp(a[1], b[1], u) + Math.sin(Math.PI * u) * lift,
      lerp(a[2], b[2], u),
    ];
    for (let s = 0; s < 20; s++) strokes.line(at(s / 20), at((s + 1) / 20), ink, light);
  };
  const of = (f: number, i: number) => files.find((file) => file.f === f && file.n === i)!;
  files.forEach((file, at) => {
    if (file.lit || hash(at, 81) > 0.34) return;
    const other = files[Math.floor(hash(at, 82) * files.length)]!;
    const far = Math.hypot(other.at[0] - file.at[0], other.at[2] - file.at[2]);
    arc(file.at, other.at, BLUE, 0.2, far * 0.16);
  });
  // What each changed file is used by lights up with it.
  CHANGED.forEach(([f, i], c) => {
    const file = of(f, i);
    if (f !== 0) arc(of(0, 0).at, file.at, HOT, 1, 0.4);
    else if (c > 0) arc(of(0, 0).at, file.at, HOT, 0.9, 0.12);
    for (let u = 0; u < 3; u++) {
      const user = files[Math.floor(hash(c * 7 + u, 91) * files.length)]!;
      arc(file.at, user.at, HOT, 0.5, 0.34);
    }
  });
  return {
    pos: field.pos,
    ink: field.ink,
    eye: GALAXY,
    lines: strokes.done(),
    label(pen) {
      const { frame, narrow } = pen;
      const big = narrow ? 34 : 46;
      text(pen, "9 files", frame.x + 6, frame.y + big, big, "#f5f5f5", 650);
      text(
        pen,
        "changed of 366, and what uses them",
        frame.x + 8,
        frame.y + big + 20,
        narrow ? 11 : 12.5,
        MUTED,
      );
      for (const folder of FOLDERS) {
        if (folder.name === "search") continue;
        // A folder at the back is named over its files, one at the front under them.
        const back = folder.at[2] < -0.5;
        const [x, y] = pen.place([folder.at[0], folder.at[1], folder.at[2] + (back ? -0.5 : 0.5)]);
        text(
          pen,
          folder.name,
          x,
          Math.min(y + (back ? -8 : 16), frame.y + frame.h - 6),
          narrow ? 10.5 : 12,
          MUTED,
          400,
          "center",
        );
      }
      const [sx, sy] = pen.place([0, -0.02, 0.3]);
      text(pen, "search", sx, sy + 16, narrow ? 11 : 12.5, "#f5f5f5", 600, "center");
      text(pen, "7 of the 9", sx, sy + 32, narrow ? 11 : 12.5, MUTED, 400, "center");
      if (!narrow) tag(pen, of(6, 4).at, "search.test.ts", "", 22);
    },
  };
}

// ── The page it would build ─────────────────────────────────────────────────
const PW = 1140,
  PH = 780;
function layer(draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = PW;
  canvas.height = PH;
  draw(canvas.getContext("2d")!);
  return canvas;
}
const RESULTS = [
  ["Invoice templates", "Start from a template and send it in a minute."],
  ["Send your first invoice", "Pick a template, add a line, press Send."],
  ["Invoice numbering", "Numbers follow the year unless a template says not to."],
] as const;
function pageLayers(): readonly HTMLCanvasElement[] {
  const font = (ctx: CanvasRenderingContext2D, weight: number, size: number) =>
    (ctx.font = `${weight} ${size}px ${SANS}`);
  const box = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  const rowAt = (n: number) => 268 + n * 150;
  /** Each result's title, split where the words that match are. */
  const marked = (
    ctx: CanvasRenderingContext2D,
    visit: (words: string, x: number, w: number, y: number, hit: boolean, size: number) => void,
  ) =>
    RESULTS.forEach(([title, more], n) => {
      for (const [line, size, weight, dy] of [
        [title, 32, 620, 56],
        [more, 23, 400, 96],
      ] as const) {
        font(ctx, weight, size);
        let x = 118;
        for (const words of line.split(/(invoice|template)/iu)) {
          const w = ctx.measureText(words).width;
          visit(words, x, w, rowAt(n) + dy, /^(invoice|template)$/iu.test(words), size);
          x += w;
        }
      }
    });
  return [
    layer((ctx) => {
      box(ctx, 2, 2, PW - 4, PH - 4, 26);
      ctx.fillStyle = "rgba(20,20,24,.94)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.2)";
      ctx.lineWidth = 2;
      ctx.stroke();
      font(ctx, 680, 27);
      ctx.fillStyle = "#f5f5f5";
      ctx.fillText("Website", 60, 64);
      font(ctx, 400, 23);
      ctx.fillStyle = "rgba(245,245,245,.55)";
      for (const [n, name] of ["Docs", "Pricing", "Sign in"].entries())
        ctx.fillText(name, 770 + n * 112, 63);
      ctx.fillStyle = "rgba(255,255,255,.1)";
      ctx.fillRect(2, 94, PW - 4, 2);
    }),
    layer((ctx) => {
      box(ctx, 60, 126, PW - 120, 92, 18);
      ctx.fillStyle = "rgba(38,38,52,.96)";
      ctx.fill();
      ctx.strokeStyle = "rgba(140,140,255,.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(106, 170, 14, 0, 7);
      ctx.moveTo(117, 181);
      ctx.lineTo(127, 191);
      ctx.strokeStyle = "rgba(245,245,245,.7)";
      ctx.stroke();
      font(ctx, 480, 32);
      ctx.fillStyle = "#f5f5f5";
      ctx.fillText("invoice template", 152, 183);
      ctx.fillStyle = "#8f95ff";
      ctx.fillRect(154 + ctx.measureText("invoice template").width, 152, 3, 40);
    }),
    layer((ctx) => {
      RESULTS.forEach((_, n) => {
        box(ctx, 84, rowAt(n), PW - 168, 132, 18);
        ctx.fillStyle = n === 0 ? "rgba(52,50,84,.95)" : "rgba(28,28,34,.94)";
        ctx.fill();
      });
      marked(ctx, (words, x, _w, y, hit, size) => {
        ctx.fillStyle = hit
          ? "rgba(245,245,245,.16)"
          : size > 25
            ? "#f5f5f5"
            : "rgba(245,245,245,.6)";
        ctx.fillText(words, x, y);
      });
    }),
    layer((ctx) => {
      marked(ctx, (words, x, w, y, hit, size) => {
        if (!hit) return;
        box(ctx, x - 3, y - size * 0.9, w + 6, size * 1.24, 6);
        ctx.fillStyle = "rgba(168,108,255,.95)";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(words, x, y);
      });
    }),
    layer((ctx) => {
      font(ctx, 600, 23);
      const words = "41 pages in 18 ms";
      const w = ctx.measureText(words).width + 44;
      box(ctx, PW - 84 - w, 722 - 14, w, 50, 25);
      ctx.fillStyle = "rgba(255,143,56,.96)";
      ctx.fill();
      ctx.fillStyle = "#1a0d02";
      ctx.fillText(words, PW - 62 - w, 741);
      for (const [n, key] of ["↑", "↓", "↵"].entries()) {
        box(ctx, 86 + n * 62, 708, 50, 50, 12);
        ctx.fillStyle = "rgba(60,60,70,.96)";
        ctx.fill();
        ctx.fillStyle = "#f5f5f5";
        ctx.fillText(key, 101 + n * 62, 741);
      }
    }),
  ];
}
const LAYERS = [
  "The page",
  "The search field",
  "Answers as you type",
  "Why each one matches",
  "How fast, and by hand",
] as const;
const APART: Eye = { yaw: -0.6, pitch: 0.34, far: 4.2, at: [-0.2, -0.03, 0.02], sway: 0.07 };
const WHOLE: Eye = { yaw: 0, pitch: 0, far: 2.65, at: [0, 0, 0], sway: 0.035 };
const HALF_W = 1.14,
  HALF_H = 0.78;
let drawn: readonly HTMLCanvasElement[] | null = null;
/** Points where the layers have something on them, dealt over the layers. */
let grains: Float32Array | null = null;
function page(count: number, apart: boolean): Shape {
  const layers = (drawn ??= pageLayers());
  if (grains === null || grains.length !== count * 7) {
    grains = new Float32Array(count * 7);
    const pixels = layers.map((each) => each.getContext("2d")!.getImageData(0, 0, PW, PH).data);
    for (let n = 0, tries = 0; n < count; tries++) {
      const l = n % layers.length;
      const x = Math.floor(hash(tries, 101) * PW),
        y = Math.floor(hash(tries, 102) * PH);
      const i = (y * PW + x) * 4;
      const light = (pixels[l]![i]! + pixels[l]![i + 1]! + pixels[l]![i + 2]!) / 765;
      // Bright ink takes most of the points, so letters and edges form; a panel takes a few.
      const keep = pixels[l]![i + 3]! > 60 && hash(tries, 103) < 0.05 + light;
      if (!keep && tries < count * 60) continue;
      grains.set(
        [
          x / PW,
          y / PH,
          l,
          pixels[l]![i]! / 255,
          pixels[l]![i + 1]! / 255,
          pixels[l]![i + 2]! / 255,
          light,
        ],
        n * 7,
      );
      n++;
    }
  }
  const gap = apart ? 0.3 : 0.002;
  const deep = (l: number) => (l - (layers.length - 1) / 2) * gap;
  const field = new Field(count);
  for (let n = 0; n < count; n++) {
    const [u, v, l, r, g, b, light] = grains.subarray(n * 7, n * 7 + 7) as unknown as number[];
    field.put(
      n,
      (u! * 2 - 1) * HALF_W,
      (1 - v! * 2) * HALF_H,
      deep(l!),
      [r!, g!, b!],
      0.35 + 0.55 * light!,
      1.6,
    );
  }
  const strokes = new Strokes();
  for (const [x, y] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    for (let l = 0; l + 1 < layers.length; l++)
      strokes.line(
        [x * HALF_W, y * HALF_H, deep(l)],
        [x * HALF_W, y * HALF_H, deep(l + 1)],
        INK,
        apart ? 0.28 : 0,
      );
  return {
    pos: field.pos,
    ink: field.ink,
    eye: apart ? APART : WHOLE,
    family: "page",
    dim: 0,
    lines: strokes.done(),
    sheets: layers.map((image, l): Sheet => ({
      image,
      corners: [
        [-HALF_W, HALF_H, deep(l)],
        [HALF_W, HALF_H, deep(l)],
        [-HALF_W, -HALF_H, deep(l)],
        [HALF_W, -HALF_H, deep(l)],
      ],
    })),
    ...(apart
      ? {
          label(pen: Pen) {
            const { ctx, frame, narrow } = pen;
            if (narrow) return;
            ctx.globalAlpha *= clamp(1 - pen.along * 4);
            const size = 12.5;
            LAYERS.forEach((name, l) => {
              const [x, y] = pen.place([-HALF_W, HALF_H, deep(l)]);
              const tx = frame.x + 6,
                ty = frame.y + size + 6 + l * 22;
              text(pen, name, tx, ty, size, "#f5f5f5", 500);
              const from = tx + ctx.measureText(name).width + 8;
              ctx.strokeStyle = "rgba(245,245,245,.3)";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(from, ty - 4);
              if (x > from) ctx.lineTo(x, ty - 4);
              ctx.lineTo(x, y);
              ctx.stroke();
            });
          },
        }
      : {}),
  };
}

/** The shapes one page goes through, in order. */
export function shapesOf(name: PageName, count: number): readonly Shape[] {
  if (name === "queries") return [land(count, "before"), land(count, "after")];
  if (name === "flow") return [flow(count)];
  if (name === "code") return [code(count)];
  return [page(count, true), page(count, false)];
}

/**
 * A wall of words as a shape: points where its picture has ink, each in the row it is read in, and
 * across the land the way it lay across the wall. `at` is where the picture's part lies on the canvas.
 */
export function wall(
  count: number,
  picture: CanvasImageSource,
  from: { x: number; y: number; w: number; h: number },
  at: { x: number; y: number; w: number; h: number },
): Shape {
  const canvas = document.createElement("canvas");
  canvas.width = from.w;
  canvas.height = from.h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(picture, from.x, from.y, from.w, from.h, 0, 0, from.w, from.h);
  const pixels = ctx.getImageData(0, 0, from.w, from.h).data;
  const inked: number[] = [];
  for (let i = 0; i < from.w * from.h; i++) if (pixels[i * 4]! > 120) inked.push(i);
  const field = new Field(count);
  const waits = new Float32Array(count);
  if (inked.length === 0) return { pos: field.pos, ink: field.ink, eye: null, waits };
  const grains = Array.from(
    { length: count },
    (_, n) => inked[Math.floor(hash(n, 6) * inked.length)]!,
  );
  grains.sort((a, b) => (a % from.w) - (b % from.w));
  const order = Array.from({ length: count }, (_, n) => n).sort(
    (a, b) => ((a % QUERIES) % ACROSS) - ((b % QUERIES) % ACROSS) || a - b,
  );
  order.forEach((n, g) => {
    const i = grains[g]!;
    const u = ((i % from.w) + hash(n, 7)) / from.w,
      v = (Math.floor(i / from.w) + hash(n, 8)) / from.h;
    field.put(n, at.x + u * at.w, at.y + v * at.h, 0, INK, 0.55, 1.25);
    waits[n] = clamp(v * 0.9 + u * 0.06 + hash(n, 9) * 0.04);
  });
  return { pos: field.pos, ink: field.ink, eye: null, waits };
}

/** A loose cloud: what a page's points come in from when it is opened. */
export function cloud(count: number): Shape {
  const field = new Field(count);
  for (let n = 0; n < count; n++) {
    const [x, y, z] = onBall(n, 1);
    const r = 1.2 + 1.2 * hash(n, 2);
    field.put(n, x * r * 1.4, y * r, z * r, BLUE, 0.12, 1.4);
  }
  return { pos: field.pos, ink: field.ink, eye: { ...LAND, far: 5 } };
}
