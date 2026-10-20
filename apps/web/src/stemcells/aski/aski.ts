// A script becomes frames. `frameAt(t)` is pure: the same script and seed give the
// same frame at the same time, whether you play forward, seek, or render offline.
// Springs run at a fixed 240 steps a second from t = 0; seeking back replays.

import {
  ACTS,
  type ActContext,
  type ActName,
  blinkAt,
  type Controls,
  type Impulse,
  restControls,
} from "./acts.ts";
import { CROWN, EYES, FOOT_L, FOOT_R, GOO, LEFT, LOBES, RIGHT } from "./canon.ts";
import { poseAt } from "./dance.ts";
import type { EyePose } from "./eye.ts";
import { lerp } from "./math.ts";

export interface Cue {
  readonly at: number;
  readonly act: ActName;
  readonly args?: Record<string, unknown>;
}
export interface Script {
  readonly seed: number;
  readonly x?: number;
  readonly cues: readonly Cue[];
}

interface Placed {
  readonly start: number;
  readonly dur: number;
  readonly act: ActName;
  readonly args: Record<string, unknown>;
  readonly ctx: ActContext;
}

export interface Limbs {
  readonly w: number;
  /** ax, ay, bx, by, half-width per segment, body space. */
  readonly segs: Float64Array;
  /** x, y, r for the two hands and two feet. */
  readonly ends: Float64Array;
}

export interface Frame {
  readonly t: number;
  readonly seed: number;
  readonly x: number;
  readonly facing: number;
  readonly lift: number;
  readonly melt: number;
  /** x, y, r per lobe, body space (relative to the ground point under Aski). */
  readonly lobes: Float64Array;
  readonly goo: number;
  readonly eyes: readonly [EyePose, EyePose];
  readonly limbs: Limbs | null;
  readonly controls: Readonly<Controls>;
}

export interface Look {
  readonly x: number;
  readonly y: number;
}

const STEP = 1 / 240;
const ANCHOR = [LEFT, RIGHT, FOOT_L, FOOT_R] as const;

export class Aski {
  readonly script: Script;
  readonly length: number;
  private readonly placed: Placed[] = [];
  private readonly impulses: { at: number; vy: number }[] = [];
  private sim!: Sim;

  constructor(script: Script) {
    this.script = script;
    let x = script.x ?? 0,
      dir: 1 | -1 = 1,
      end = 0;
    for (const cue of [...script.cues].sort((a, b) => a.at - b.at)) {
      const act = ACTS[cue.act] as (typeof ACTS)[ActName] | undefined;
      if (!act) throw new Error(`Unknown act: ${cue.act}`);
      const args = (cue.args ?? {}) as never;
      const ctx: ActContext = { x, dir, seed: script.seed };
      const dur = act.duration(args, ctx);
      this.placed.push({ start: cue.at, dur, act: cue.act, args, ctx });
      for (const im of (
        act as { impulses?: (a: never, d: number) => readonly Impulse[] }
      ).impulses?.(args, dur) ?? [])
        this.impulses.push({ at: cue.at + im.at, vy: im.vy });
      const ends = (
        act as { ends?: (a: never, c: ActContext) => { x: number; dir: 1 | -1 } }
      ).ends?.(args, ctx);
      if (ends) ({ x, dir } = ends);
      end = Math.max(end, cue.at + dur);
    }
    this.impulses.sort((a, b) => a.at - b.at);
    this.length = end + 1;
    this.reset();
  }

  /** The controls at time t: where Aski stands, and what every act asks of it. */
  controlsAt(t: number, look?: Look): Controls {
    let x = this.script.x ?? 0,
      dir: 1 | -1 = 1;
    for (const p of this.placed)
      if (p.start + p.dur <= t) {
        const e = (
          ACTS[p.act] as { ends?: (a: never, c: ActContext) => { x: number; dir: 1 | -1 } }
        ).ends?.(p.args as never, p.ctx);
        if (e) ({ x, dir } = e);
      }
    const c = restControls(x, dir);
    for (const p of this.placed) {
      const u = t - p.start;
      if (u >= 0 && u < p.dur)
        (ACTS[p.act].apply as (c: Controls, u: number, d: number, a: never, x: ActContext) => void)(
          c,
          u,
          p.dur,
          p.args as never,
          p.ctx,
        );
    }
    c.open *= blinkAt(t, this.script.seed);
    if (look) {
      c.gazeX = lerp(look.x, c.gazeX, c.look);
      c.gazeY = lerp(look.y, c.gazeY, c.look);
    }
    return c;
  }

  /** The frame at time t. Forward calls continue the simulation; earlier times replay it. */
  frameAt(t: number, look?: Look): Frame {
    if (t < this.sim.t - 1e-9) this.reset();
    while (this.sim.t + STEP <= t + 1e-9) this.step(look);
    const c = this.controlsAt(t, look);
    return this.compose(t, c);
  }

  private reset(): void {
    const c = this.controlsAt(0);
    this.sim = {
      t: 0,
      imp: 0,
      facing: c.dir,
      prevX: c.x,
      prevV: 0,
      lobes: LOBES.map((l) => ({ x: l.x, y: l.y, r: l.r, vx: 0, vy: 0, vr: 0 })),
      ends: ANCHOR.map((i) => ({
        x: LOBES[i]!.x,
        y: LOBES[i]!.y,
        r: LOBES[i]!.r,
        vx: 0,
        vy: 0,
        vr: 0,
      })),
      joints: ANCHOR.map((i) => ({ x: LOBES[i]!.x, y: LOBES[i]!.y, r: 0, vx: 0, vy: 0, vr: 0 })),
    };
  }

  private step(look?: Look): void {
    const s = this.sim,
      t = s.t + STEP,
      c = this.controlsAt(t, look);
    // Kicks scheduled by acts (a hop's take-off, a melt's boing).
    while (s.imp < this.impulses.length && this.impulses[s.imp]!.at <= t) {
      const vy = this.impulses[s.imp++]!.vy;
      for (const [i, L] of s.lobes.entries()) L.vy -= vy * (i < 3 ? 1 : 0.4);
    }
    // Inertia: when Aski speeds up or stops, the upper body lags behind.
    const v = (c.x - s.prevX) / STEP,
      acc = (v - s.prevV) / STEP;
    s.prevX = c.x;
    s.prevV = v;
    s.lobes.forEach((L, i) => {
      if (i < 3) L.vx -= acc * STEP * 0.5;
    });
    s.facing += (c.dir - s.facing) * (1 - Math.exp(-STEP * 16));
    const targets = bodyTargets(c, t);
    for (const [i, L] of s.lobes.entries()) spring(L, targets[i]!, LOBES[i]!.k, LOBES[i]!.zeta);
    if (c.limbs > 0 || c.dance > 0) {
      const pose = poseAt(c.beat);
      const limbs = [pose.la, pose.ra, pose.ll, pose.rl];
      ANCHOR.forEach((a, i) => {
        const A = s.lobes[a]!;
        let j: Target = [A.x, A.y, 0],
          e: Target = [A.x, A.y, A.r * 0.9];
        if (c.dance > 0) {
          const [[ex, ey], [hx, hy]] = limbs[i]!;
          j = [A.x + ex, A.y + ey, 0];
          e = [A.x + hx, A.y + hy, i < 2 ? 13 : 12];
        }
        spring(s.joints[i]!, j, 420, 0.42);
        spring(s.ends[i]!, e, 420, 0.42);
      });
    } else {
      ANCHOR.forEach((a, i) => {
        const A = s.lobes[a]!;
        Object.assign(s.ends[i]!, { x: A.x, y: A.y, r: A.r * 0.9, vx: 0, vy: 0, vr: 0 });
        Object.assign(s.joints[i]!, { x: A.x, y: A.y, vx: 0, vy: 0 });
      });
    }
    s.t = t;
  }

  private compose(t: number, c: Controls): Frame {
    const s = this.sim,
      f = s.facing,
      crown = s.lobes[CROWN]!;
    // The eyes belong to the crown: they ride it and grow or shrink with it.
    const es = Math.min(1.2, Math.max(0.6, crown.r / LOBES[CROWN]!.r));
    const eyes = EYES.centers.map(([ex, ey]) => ({
      x: crown.x + (ex - LOBES[CROWN]!.x) * f * es + c.gazeX * 7 * es,
      y: crown.y + (ey - LOBES[CROWN]!.y) * es + c.gazeY * 6 * es,
      height: EYES.height * es,
      open: c.open,
      rot: c.eyeRot,
      facing: f,
    })) as unknown as readonly [EyePose, EyePose];
    let limbs: Limbs | null = null;
    if (c.limbs > 0.001) {
      const thick = (w: number) => lerp(30, w, Math.min(1, c.limbs));
      const segs: number[] = [];
      ANCHOR.forEach((a, i) => {
        const A = s.lobes[a]!,
          J = s.joints[i]!,
          E = s.ends[i]!,
          w = thick(i < 2 ? 7 : 8.5);
        segs.push(A.x, A.y, J.x, J.y, w, J.x, J.y, E.x, E.y, w);
      });
      for (const [i, dx] of [
        [2, -1],
        [3, 1],
      ] as const) {
        const E = s.ends[i]!;
        segs.push(E.x, E.y + 2, E.x + dx * 22, E.y + 5, thick(10));
      }
      limbs = {
        w: c.limbs,
        segs: Float64Array.from(segs),
        ends: Float64Array.from(s.ends.flatMap((e) => [e.x, e.y, Math.max(1, e.r)])),
      };
    }
    return {
      t,
      seed: this.script.seed,
      x: c.x,
      facing: f,
      lift: c.lift,
      melt: c.melt,
      lobes: Float64Array.from(s.lobes.flatMap((l) => [l.x, l.y, Math.max(1, l.r)])),
      goo:
        GOO.rest +
        GOO.walk * c.walk +
        GOO.melt * c.melt +
        GOO.wave * c.wave +
        GOO.tuck * c.tuck +
        GOO.squash * Math.abs(c.squash),
      eyes,
      limbs,
      controls: c,
    };
  }
}

interface Body {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  vr: number;
}
type Target = readonly [number, number, number];
interface Sim {
  t: number;
  imp: number;
  facing: number;
  prevX: number;
  prevV: number;
  lobes: Body[];
  ends: Body[];
  joints: Body[];
}

function spring(b: Body, [tx, ty, tr]: Target, k: number, zeta: number): void {
  const d = 2 * zeta * Math.sqrt(k);
  b.vx += (k * (tx - b.x) - d * b.vx) * STEP;
  b.vy += (k * (ty - b.y) - d * b.vy) * STEP;
  b.vr += (k * (tr - b.r) - d * b.vr) * STEP;
  b.x += b.vx * STEP;
  b.y += b.vy * STEP;
  b.r += b.vr * STEP;
}

/** Where each lobe wants to be, given the controls. */
function bodyTargets(c: Controls, t: number): Target[] {
  if (c.dance > 0) return danceBody(c);
  const d = c.dir,
    s = Math.sin(c.phase),
    co = Math.cos(c.phase),
    w = c.walk;
  const front = d > 0 ? RIGHT : LEFT,
    back = d > 0 ? LEFT : RIGHT;
  const sx = 1 + 0.13 * c.squash,
    sy = 1 / sx;
  return LOBES.map((l, i) => {
    let x = l.x * d,
      y = l.y,
      r = l.r;
    if (i === FOOT_L) {
      x += d * 15 * s * w;
      y -= Math.max(0, co) * 24 * w;
    }
    if (i === FOOT_R) {
      x -= d * 15 * s * w;
      y -= Math.max(0, -co) * 24 * w;
    }
    if (i >= FOOT_L) {
      y -= c.tuck * 26;
      r *= 1 - 0.12 * c.tuck;
    }
    if (i < FOOT_L) {
      y -= 12 * w * Math.abs(co);
      const a = d * (0.09 * w + c.lean),
        pivot = -60,
        rx = x,
        ry = y - pivot;
      x = rx * Math.cos(a) - ry * Math.sin(a);
      y = pivot + rx * Math.sin(a) + ry * Math.cos(a);
      if (i === front) {
        x += d * 6 * s * w;
        y -= 5 * s * w;
      }
      if (i === back) {
        x -= d * 6 * s * w;
        y += 5 * s * w;
      }
      if (i === front && c.wave) {
        y -= 64 * c.wave;
        x += d * (26 * c.wave + 11 * Math.sin(t * 13) * c.wave);
        r *= 1 - 0.32 * c.wave;
      }
      if (i === CROWN) r *= 1 + 0.014 * Math.sin((t * Math.PI * 2) / 2.95) * (1 - w);
    }
    x *= sx;
    y *= sy;
    y -= c.lift;
    if (c.melt) {
      y += (-r * 0.42 - y) * c.melt;
      x *= 1 + 0.75 * c.melt;
      r *= 1 - 0.18 * c.melt;
    }
    return [x, y, r] as const;
  });
}

/** The dancer's body: the cloud a little smaller, up on its new legs, dipping on each beat. */
function danceBody(c: Controls): Target[] {
  const b = Math.max(0, c.beat),
    ph = b % 1,
    pose = poseAt(b),
    on = (1 - ph) ** 3;
  const foot = Math.max(pose.ll[1][1], pose.rl[1][1]);
  const hip = -14 - foot + 9 * on - (pose.lift ?? 0) * Math.sin(Math.PI * Math.min(1, ph * 1.2));
  const sway = (pose.sway ?? 0) + (Math.floor(b) % 2 ? 6 : -6);
  return LOBES.map(
    (l, i) =>
      [
        l.x * 0.8 + sway,
        l.y * 0.8 + hip + 46 - (i === CROWN ? 6 * on : 0),
        l.r * 0.8 * (i === CROWN ? 1 + 0.04 * on : 1),
      ] as const,
  );
}
