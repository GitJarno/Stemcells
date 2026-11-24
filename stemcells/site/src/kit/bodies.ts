// A body is a thing made of characters: each with a place, a size and an ink.
// One body turns into another by its characters travelling, never by a cut:
// both are walked along the same space-filling curve, so neighbours stay
// neighbours and the whole moves as one, whatever the two counts are.

import { ease, hash, lerp } from "./form.ts";
import { type Glyphs, INK, type Rgb } from "./glyphs.ts";

export interface Mark {
  /** Its centre, CSS pixels. */
  readonly x: number;
  readonly y: number;
  readonly ch: string;
  /** Its cell's height, CSS pixels; a cell is half as wide. */
  readonly h: number;
  readonly rgb: Rgb;
  readonly a: number;
}
export type Body = readonly Mark[];

/** The grid's reading size, CSS pixels a cell's height. */
export const READ = 16;

export interface TextLook {
  /** The block's left edge (or its middle, centred) and its top, CSS pixels. */
  readonly x: number;
  readonly y: number;
  readonly h?: number;
  readonly rgb?: Rgb;
  readonly a?: number;
  readonly align?: "left" | "center";
  /** Characters drawn in another ink: `ch` to [rgb, alpha]. */
  readonly inks?: Readonly<Record<string, readonly [Rgb, number]>>;
}

/** Lines of text as a body, one mark a character that isn't a space. */
export function textBody(text: string | readonly string[], look: TextLook): Mark[] {
  const lines = typeof text === "string" ? text.split("\n") : text;
  const { h = READ, rgb = INK, a = 1 } = look;
  const w = h / 2;
  const marks: Mark[] = [];
  lines.forEach((line, j) => {
    const chars = [...line];
    const left = look.align === "center" ? look.x - (chars.length * w) / 2 : look.x;
    chars.forEach((ch, i) => {
      if (ch === " ") return;
      const ink = look.inks?.[ch];
      marks.push({
        x: left + (i + 0.5) * w,
        y: look.y + (j + 0.5) * h,
        ch,
        h,
        rgb: ink?.[0] ?? rgb,
        a: ink?.[1] ?? a,
      });
    });
  });
  return marks;
}

/** How wide and tall `text` stands at `h`, CSS pixels. */
export function extent(text: string | readonly string[], h = READ): readonly [number, number] {
  const lines = typeof text === "string" ? text.split("\n") : text;
  return [(Math.max(0, ...lines.map((l) => [...l].length)) * h) / 2, lines.length * h];
}

export function drawBody(g: Glyphs, body: Body, alpha = 1, dx = 0, dy = 0): void {
  for (const m of body) g.put(m.ch, m.x + dx, m.y + dy, m.h, m.rgb, m.a * alpha);
}

/** Where (x, y) in 0..1 falls along a Hilbert curve of 2^order cells a side. */
function hilbert(x: number, y: number, order = 7): number {
  const side = 1 << order;
  let i = Math.min(side - 1, Math.max(0, Math.floor(x * side))),
    j = Math.min(side - 1, Math.max(0, Math.floor(y * side))),
    d = 0;
  for (let s = side >> 1; s > 0; s >>= 1) {
    const rx = (i & s) > 0 ? 1 : 0,
      ry = (j & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        i = s - 1 - i;
        j = s - 1 - j;
      }
      [i, j] = [j, i];
    }
  }
  return d;
}

function alongCurve(body: Body): number[] {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const m of body) {
    x0 = Math.min(x0, m.x);
    y0 = Math.min(y0, m.y);
    x1 = Math.max(x1, m.x);
    y1 = Math.max(y1, m.y);
  }
  const side = Math.max(1, x1 - x0, y1 - y0);
  const at = body.map((m) => hilbert((m.x - x0) / side, (m.y - y0) / side));
  return body.map((_, n) => n).sort((a, b) => at[a]! - at[b]!);
}

export interface MorphLook {
  /** How much of the move is the wave passing along the body, 0..1. */
  readonly stagger?: number;
  /** How high a character's arc lifts at most, CSS pixels. */
  readonly lift?: number;
  readonly seed?: number;
}

/** One body turning into another. `draw(g, u)` is pure: u 0 is the first, 1 the second. */
export class Morph {
  readonly from: Body;
  readonly to: Body;
  readonly #pairs: Int32Array;
  readonly #first: Uint8Array;
  readonly #look: Required<MorphLook>;

  constructor(from: Body, to: Body, look: MorphLook = {}) {
    this.from = from;
    this.to = to;
    this.#look = { stagger: 0.45, lift: 60, seed: 1, ...look };
    const a = alongCurve(from),
      b = alongCurve(to);
    const count = Math.max(a.length, b.length);
    this.#pairs = new Int32Array(count * 2);
    this.#first = new Uint8Array(count * 2);
    let lastA = -1,
      lastB = -1;
    for (let k = 0; k < count && a.length > 0 && b.length > 0; k++) {
      const ia = a[Math.floor((k * a.length) / count)]!,
        ib = b[Math.floor((k * b.length) / count)]!;
      this.#pairs[k * 2] = ia;
      this.#pairs[k * 2 + 1] = ib;
      // A mark shared by several travellers is drawn whole by the first only.
      this.#first[k * 2] = ia === lastA ? 0 : 1;
      this.#first[k * 2 + 1] = ib === lastB ? 0 : 1;
      lastA = ia;
      lastB = ib;
    }
  }

  draw(g: Glyphs, u: number, alpha = 1): void {
    if (u <= 0 || this.to.length === 0) return drawBody(g, this.from, alpha);
    if (u >= 1 || this.from.length === 0) return drawBody(g, this.to, alpha);
    const { stagger, lift, seed } = this.#look;
    const count = this.#pairs.length / 2;
    for (let k = 0; k < count; k++) {
      const a = this.from[this.#pairs[k * 2]!]!,
        b = this.to[this.#pairs[k * 2 + 1]!]!;
      const wait = stagger * (0.8 * (k / count) + 0.2 * hash(k, seed));
      const local = Math.min(1, Math.max(0, (u - wait) / (1 - stagger)));
      const e = ease.inOut(local);
      const far = Math.hypot(b.x - a.x, b.y - a.y);
      const x = lerp(a.x, b.x, e),
        y =
          lerp(a.y, b.y, e) -
          Math.sin(Math.PI * e) * Math.min(lift, far * 0.35) * (0.5 + hash(k, seed + 7));
      const h = lerp(a.h, b.h, e);
      const rgb: Rgb = [
        lerp(a.rgb[0], b.rgb[0], e),
        lerp(a.rgb[1], b.rgb[1], e),
        lerp(a.rgb[2], b.rgb[2], e),
      ];
      // A traveller that shares its mark stays unseen until it has left it.
      const leaving = this.#first[k * 2] === 1 ? 1 : Math.min(1, e * 5),
        arriving = this.#first[k * 2 + 1] === 1 ? 1 : Math.min(1, (1 - e) * 5);
      if (a.ch === b.ch) {
        g.put(a.ch, x, y, h, rgb, lerp(a.a * leaving, b.a * arriving, e) * alpha);
        continue;
      }
      const turn = Math.min(1, Math.max(0, (e - 0.3) / 0.4));
      g.put(a.ch, x, y, h, rgb, a.a * leaving * (1 - turn) * alpha);
      g.put(b.ch, x, y, h, rgb, b.a * arriving * turn * alpha);
    }
  }
}
