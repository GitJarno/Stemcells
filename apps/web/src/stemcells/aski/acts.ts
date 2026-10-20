// Acts are what Aski does. Each one is a pure function of its own local time:
// it writes a few named controls, and the rig turns controls into a body. Acts
// never touch the body directly, so any act can follow or overlap any other.

import { clamp, ease, envelope, hash, lerp, unlerp } from "./math.ts";

export interface Controls {
  x: number; // where Aski stands, canon units
  dir: 1 | -1; // the way it faces
  walk: number; // 0..1 gait weight
  phase: number; // stride phase, radians
  squash: number; // + flattens, - stretches; volume is kept
  lift: number; // off the ground, canon units
  tuck: number; // feet drawn up, 0..1
  lean: number; // radians, + leans forward
  wave: number; // the front hand up, 0..1
  melt: number; // slumped into a puddle, 0..1
  open: number; // eyelids, 1 open
  eyeRot: number; // radians; π is the opening quote
  gazeX: number; // -1..1
  gazeY: number;
  look: number; // 0..1: how much the act's gaze overrides the host's
  dance: number; // 0..1: the dancer's body
  limbs: number; // 0..1: limbs grown out of the lobes
  beat: number; // beats since the dancer popped out, or -1
  solid: number; // ink body visible, 0..1
  particles: number; // character particles visible, 0..1
  pt: number; // seconds since the burst
  settle: number; // particles settled onto the grid (ASCII), 0..1
  fill: number; // ASCII filling into pixels, 0..1
  resolve: number; // pixels resolving back into ink, 0..1
  live: number; // the live ASCII skin over a moving body, 0..1
}

export const restControls = (x: number, dir: 1 | -1): Controls => ({
  x,
  dir,
  walk: 0,
  phase: 0,
  squash: 0,
  lift: 0,
  tuck: 0,
  lean: 0,
  wave: 0,
  melt: 0,
  open: 1,
  eyeRot: 0,
  gazeX: 0,
  gazeY: 0,
  look: 0,
  dance: 0,
  limbs: 0,
  beat: -1,
  solid: 1,
  particles: 0,
  pt: 0,
  settle: 0,
  fill: 0,
  resolve: 0,
  live: 0,
});

export interface Impulse {
  readonly at: number; // seconds into the act
  readonly vy: number; // upward kick to the body, canon units per second
}

export interface ActContext {
  readonly x: number; // where the act starts
  readonly dir: 1 | -1;
  readonly seed: number;
}

export interface Act<A = Record<string, never>> {
  readonly duration: (args: A, ctx: ActContext) => number;
  readonly apply: (c: Controls, u: number, dur: number, args: A, ctx: ActContext) => void;
  readonly impulses?: (args: A, dur: number) => readonly Impulse[];
  /** Where it leaves Aski standing and facing. */
  readonly ends?: (args: A, ctx: ActContext) => { x: number; dir: 1 | -1 };
}

const WALK_SPEED = 190,
  STRIDE = 88,
  RAMP = 0.22;

export interface WalkArgs {
  readonly to: number;
}
const walk: Act<WalkArgs> = {
  duration: ({ to }, { x }) => Math.abs(to - x) / WALK_SPEED + RAMP,
  apply(c, u, dur, { to }, { x }) {
    const D = to - x,
      dist = Math.abs(D);
    if (dist < 0.5) return;
    const vmax = dist / (dur - RAMP);
    const s =
      u < RAMP
        ? (vmax * u * u) / (2 * RAMP)
        : u < dur - RAMP
          ? vmax * (RAMP / 2 + (u - RAMP))
          : dist - (vmax * (dur - u) ** 2) / (2 * RAMP);
    c.x = x + Math.sign(D) * s;
    c.dir = D > 0 ? 1 : -1;
    c.walk = Math.max(c.walk, envelope(u, dur, 0.18, 0.22, ease.outCubic));
    c.phase += (s / STRIDE) * Math.PI * 2;
    c.gazeX = c.dir * 0.9;
    c.gazeY = 0.1;
    c.look = Math.max(c.look, c.walk);
  },
  ends: ({ to }, { x, dir }) => ({ x: to, dir: Math.abs(to - x) < 0.5 ? dir : to > x ? 1 : -1 }),
};

// A hop: squash down, spring up stretched, tuck the feet, land in a squash.
const hop: Act = {
  duration: () => 1.25,
  apply(c, u) {
    if (u < 0.16) c.squash += 1.3 * ease.inOutCubic(u / 0.16);
    else if (u < 0.4) c.squash -= 0.9 * (1 - ease.outCubic((u - 0.16) / 0.24));
    if (u >= 0.16 && u < 0.49) {
      const k = ease.outCubic((u - 0.16) / 0.33);
      c.lift += 140 * k;
      c.tuck += k;
    }
    if (u >= 0.49 && u < 0.76) {
      const k = (u - 0.49) / 0.27;
      c.lift += 140 * (1 - k * k);
      c.tuck += 1 - k;
    }
    if (u >= 0.76) c.squash += 1 - ease.outCubic(Math.min(1, (u - 0.76) / 0.26));
  },
  impulses: () => [{ at: 0.16, vy: 300 }],
};

const hello: Act = {
  duration: () => 1.95,
  apply(c, u, dur) {
    const w = envelope(u, dur, 0.26, 0.3, ease.outCubic);
    c.wave += w;
    c.eyeRot += 0.18 * w;
  },
};

// Listening: the eyes turn into an opening quote; answering turns them back.
const listen: Act = {
  duration: () => 3.6,
  apply(c, u, dur) {
    const turn =
      u < 2.3
        ? Math.PI * ease.outBack(clamp(u / 0.6, 0, 1))
        : Math.PI + Math.PI * ease.outBack(clamp((u - 2.3) / 0.6, 0, 1));
    c.eyeRot += u >= dur - 0.05 ? 0 : turn;
    const w = envelope(u, dur, 0.5, 0.6);
    c.lean -= 0.06 * w;
    c.squash -= 0.25 * w;
    c.gazeY = -0.2;
    c.look = Math.max(c.look, w);
  },
};

// Melting into a puddle, peeking up, then springing back with a boing.
const melt: Act = {
  duration: () => 2.8,
  apply(c, u) {
    if (u < 1.6) c.melt += ease.outCubic(Math.min(1, u / 0.9));
    if (u > 1.0 && u < 1.6) {
      c.gazeY = -1;
      c.gazeX = 0;
      c.look = 1;
    }
  },
  impulses: () => [{ at: 1.6, vy: 900 }],
};

export interface DanceArgs {
  readonly bars?: number;
  readonly bpm?: number;
  readonly ascii?: boolean;
}
const NOD_BEATS = 2,
  POP_LEAD = 0.14,
  EXIT = 0.9;
export const danceTiming = (bpm: number) => {
  const period = 60 / bpm;
  return { period, pop: NOD_BEATS * period }; // the limbs pop out exactly on the third beat
};
// The dancer: two beats of nodding as a cloud, then limbs stretch out of the lobes and it dances on the beat.
const dance: Act<DanceArgs> = {
  duration: ({ bars = 12, bpm = 112 }) => danceTiming(bpm).pop + bars * 4 * (60 / bpm) + EXIT,
  apply(c, u, dur, { bpm = 112, ascii = true }) {
    const { period, pop } = danceTiming(bpm),
      exit = dur - EXIT;
    c.dir = 1; // the dancer faces you
    if (u < pop - POP_LEAD) {
      const ph = (u / period) % 1;
      c.squash += 0.9 * (1 - ph) ** 4;
      c.eyeRot += 0.1 * Math.sin(ph * Math.PI * 2);
      return;
    }
    if (u < pop) {
      c.squash += 1.4 * ease.inOutCubic((u - (pop - POP_LEAD)) / POP_LEAD);
      return;
    }
    const b = (u - pop) / period;
    if (u < exit) {
      c.dance = 1;
      c.beat = b;
      c.limbs += ease.outCubic(Math.min(1, (u - pop) / 0.38));
      c.eyeRot += -0.16 * Math.cos(Math.PI * b);
      if (ascii) {
        // Every other routine of sixteen beats it dances as its ASCII self.
        const cyc = Math.floor(b / 16),
          into = b - cyc * 16;
        if (cyc % 2 === 1) c.live += clamp(into / 1.3, 0, 1);
        else if (cyc > 0) c.live += clamp(1 - into / 1.3, 0, 1);
      }
      return;
    }
    const v = u - exit;
    c.dance = 0;
    c.limbs += v < 0.42 ? 1 : 1 - clamp((v - 0.42) / 0.26, 0, 1);
  },
  impulses: ({ bpm = 112 }, dur) => [
    { at: danceTiming(bpm).pop, vy: 260 },
    { at: dur - EXIT + 0.7, vy: 300 },
  ],
};

// Ink → a cloud of characters → ASCII → pixels → ink.
export const DISSOLVE = {
  burst: 0.3,
  settle: [2.3, 3.1],
  fill: [4.3, 5.1],
  resolve: [6.1, 6.9],
  end: 7.4,
} as const;
const dissolve: Act = {
  duration: () => DISSOLVE.end,
  apply(c, u) {
    const D = DISSOLVE;
    if (u < 0.17) {
      c.squash += 1.2 * ease.inOutCubic(u / 0.17);
      return;
    }
    if (u < D.burst) {
      c.squash += lerp(1.2, -0.8, ease.outCubic((u - 0.17) / 0.13));
      return;
    }
    if (u >= D.resolve[1]) return;
    c.solid = 0;
    c.particles = 1;
    c.pt = u - D.burst;
    c.settle = ease.inOutCubic(unlerp(D.settle[0], D.settle[1], u));
    c.fill = unlerp(D.fill[0], D.fill[1], u);
    c.resolve = unlerp(D.resolve[0], D.resolve[1], u);
  },
  impulses: () => [{ at: DISSOLVE.resolve[1], vy: 380 }],
};

export const ACTS = { walk, hop, hello, listen, melt, dance, dissolve } as const;
export type ActName = keyof typeof ACTS;

/** One blink: the eyes squash shut over `close` seconds, to `shut` of their height, and open again over `open`. */
export const BLINK = { close: 0.07, open: 0.12, shut: 0.07 } as const;

/** Blinks are seeded: the same seed blinks at the same moments. */
export function blinkAt(t: number, seed: number): number {
  const { close, open, shut } = BLINK;
  let at = 1.6,
    i = 0;
  while (at < t + 1) {
    const u = t - at;
    if (u >= 0 && u < close) return lerp(1, shut, u / close);
    if (u >= close && u < close + open) return lerp(shut, 1, (u - close) / open);
    at += 2.2 + hash(seed, 7, i++) * 3.6;
  }
  return 1;
}
