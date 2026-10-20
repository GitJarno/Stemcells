// Small, exact helpers. Everything here is deterministic: no Math.random, no clocks.

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const unlerp = (a: number, b: number, v: number): number => clamp((v - a) / (b - a), 0, 1);
/** 0 before a, 1 after b, and a smooth step between: exactly 0 and 1 at the ends. */
export const sstep = (a: number, b: number, v: number): number => {
  const t = unlerp(a, b, v);
  return t * t * (3 - 2 * t);
};

export const ease = {
  linear: (t: number): number => t,
  inCubic: (t: number): number => t * t * t,
  outCubic: (t: number): number => 1 - (1 - t) ** 3,
  inOutCubic: (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number): number => {
    const c = 1.9;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  },
};

/** A bump that rises over `inDur`, holds, and falls over `outDur` inside [0, dur]. */
export function envelope(
  t: number,
  dur: number,
  inDur: number,
  outDur: number,
  curve = ease.inOutCubic,
): number {
  if (t <= 0 || t >= dur) return 0;
  if (t < inDur) return curve(t / inDur);
  if (t > dur - outDur) return curve((dur - t) / outDur);
  return 1;
}

/** Integer hash to [0, 1). Same inputs, same output, on every machine. */
export function hash(seed: number, a: number, b = 0, c = 0): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (a | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (b | 0) ^ (h >>> 15), 0x27d4eb2f);
  h = Math.imul(h ^ (c | 0) ^ (h >>> 13), 0x165667b1);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Polynomial smooth minimum: two ink shapes melt together over `k` units. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}

export function sdSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const pax = px - ax,
    pay = py - ay,
    bax = bx - ax,
    bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / Math.max(bax * bax + bay * bay, 1e-9), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/** Signed distance to a closed polygon given as [x0, y0, x1, y1, ...]: negative inside. */
export function sdPolygon(px: number, py: number, v: Float64Array): number {
  const n = v.length / 2;
  let d = (px - v[0]!) ** 2 + (py - v[1]!) ** 2;
  let s = 1;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const vix = v[2 * i]!,
      viy = v[2 * i + 1]!,
      vjx = v[2 * j]!,
      vjy = v[2 * j + 1]!;
    const ex = vjx - vix,
      ey = vjy - viy,
      wx = px - vix,
      wy = py - viy;
    const h = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
    const bx = wx - ex * h,
      by = wy - ey * h;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= viy,
      c2 = py < vjy,
      c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}
