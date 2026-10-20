// Distances to Aski's ink, in body space (canon units, relative to the ground
// point under it). Renderers sample these; they never invent shape of their own.

import type { Frame } from "./aski.ts";
import { GOO } from "./canon.ts";
import { eyeDistance } from "./eye.ts";
import { sdSegment, smin } from "./math.ts";

export function bodyDistance(f: Frame, x: number, y: number): number {
  const L = f.lobes;
  let d = Math.hypot(x - L[0]!, y - L[1]!) - L[2]!;
  for (let i = 3; i < L.length; i += 3)
    d = smin(d, Math.hypot(x - L[i]!, y - L[i + 1]!) - L[i + 2]!, f.goo);
  return d;
}

export function limbDistance(f: Frame, x: number, y: number): number {
  const m = f.limbs;
  if (!m) return Infinity;
  let d = Infinity;
  for (let i = 0; i < m.segs.length; i += 5)
    d = Math.min(
      d,
      sdSegment(x, y, m.segs[i]!, m.segs[i + 1]!, m.segs[i + 2]!, m.segs[i + 3]!) - m.segs[i + 4]!,
    );
  for (let i = 0; i < m.ends.length; i += 3)
    d = Math.min(d, Math.hypot(x - m.ends[i]!, y - m.ends[i + 1]!) - m.ends[i + 2]!);
  return d;
}

/** Body and limbs, melted together where they meet. */
export function sceneDistance(f: Frame, x: number, y: number): number {
  const b = bodyDistance(f, x, y);
  return f.limbs ? smin(b, limbDistance(f, x, y), GOO.limbs) : b;
}

export function eyesDistance(f: Frame, x: number, y: number): number {
  let d = Infinity;
  for (const e of f.eyes) {
    if (Math.abs(x - e.x) > e.height * 0.8 || Math.abs(y - e.y) > e.height * 0.8) {
      d = Math.min(d, e.height * 0.3);
      continue;
    }
    d = Math.min(d, eyeDistance(x, y, e));
  }
  return d;
}

/** The character a limb is drawn with in the ASCII form: - \ | / by its angle, o for hands, _ for shoes. */
export function limbChar(f: Frame, x: number, y: number): { d: number; ch: string } {
  const m = f.limbs;
  if (!m) return { d: Infinity, ch: " " };
  let d = Infinity,
    ch = "-";
  for (let i = 0, k = 0; i < m.segs.length; i += 5, k++) {
    const ax = m.segs[i]!,
      ay = m.segs[i + 1]!,
      bx = m.segs[i + 2]!,
      by = m.segs[i + 3]!;
    const s = sdSegment(x, y, ax, ay, bx, by) - m.segs[i + 4]!;
    if (s < d) {
      d = s;
      const a = ((((Math.atan2(by - ay, bx - ax) * 180) / Math.PI) % 180) + 180) % 180;
      ch = k >= 8 ? "_" : a < 22 || a > 158 ? "-" : a < 68 ? "\\" : a < 112 ? "|" : "/";
    }
  }
  for (let i = 0; i < 6; i += 3) {
    const s = Math.hypot(x - m.ends[i]!, y - m.ends[i + 1]!) - m.ends[i + 2]!;
    if (s < d) {
      d = s;
      ch = "o";
    }
  }
  return { d, ch };
}
