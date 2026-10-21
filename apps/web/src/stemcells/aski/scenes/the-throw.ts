// Aski's part of a spawn (stemcells/docs/interaction.md, The spawn). The words
// pour in and orbit, and the streams go out to the panes; Aski only watches
// and throws. `theWait` is in and around: its eyes look down at the words
// coming from the composer, then ride their orbit. `theThrow` is out: a pulse
// for each stream as it leaves, its eyes on that stream's pane, and `^ ^`
// once the last one is away. The times are the motion tokens, read by the
// page and handed in, in seconds.

import { blinkAt } from "../acts.ts";
import { BODY_HEIGHT } from "../canon.ts";
import { type Grid, makeGrid, put, type Stage } from "../grid.ts";
import { clamp, ease } from "../math.ts";
import type { Mood } from "../mood.ts";
import {
  cloudAtRest,
  cloudCells,
  type EyePlace,
  homeFit,
  type SceneCard,
  spell,
} from "../scene.ts";
import { eyesLooking } from "../moments/stage.ts";

/** How far the eyes look, canon units: down at the words, round the orbit, toward a pane. */
const LOOK = 5;
/** How long the eyes take to look down as the words come, seconds. */
const LOOK_IN = 0.25;
/** How long either part holds once it has played, seconds, while the composer is yet to call. */
const HOLD = 120;
/** Streams in flight at once: a fifth leaves when the first lands. */
const IN_FLIGHT = 4;

/** In and around: `lookIn`, the words' pour (`letters-span` plus `travel`); `turn`, one turn of their orbit (`orbit-turn`; 0, none known, keeps the eyes down). */
export interface WaitTimes {
  readonly lookIn: number;
  readonly turn: number;
}

/** Out: `stagger`, the streams' gap (`spawn-stagger`); `travel`, one stream's flight; `flick`, one pulse. */
export interface ThrowTimes {
  readonly stagger: number;
  readonly travel: number;
  readonly flick: number;
}

/** Where the eyes look at t while Aski waits: down at the words coming in, then round with their orbit, starting from down. */
export function waitLook(t: number, times: WaitTimes): readonly [number, number] {
  if (t < times.lookIn || !(times.turn > 0))
    return [0, LOOK * ease.outCubic(clamp(t / LOOK_IN, 0, 1))];
  const angle = Math.PI / 2 + (2 * Math.PI * (t - times.lookIn)) / times.turn;
  return [Math.cos(angle) * LOOK, Math.sin(angle) * LOOK];
}

export function theWait(times: WaitTimes, seed = 7): SceneCard {
  const end = times.lookIn + HOLD;
  return {
    id: "the-wait",
    seed,
    beats: { in: 0, around: times.lookIn },
    end,
    still: times.lookIn,
    lines: [],
    home: true,
    eyes: (t) => (t === times.lookIn ? 1 : blinkAt(t, seed)),
    eyesAt: (t, stage) => eyesLooking(stage, waitLook(Math.min(t, end), times)),
    frame: (_t, stage) => cloudAtRest(stage),
  };
}

/** When stream `k` leaves, and its pulse starts, and when the last pulse is over, seconds into the throw. */
export function throwAt(k: number, times: ThrowTimes): number {
  return k < IN_FLIGHT
    ? k * times.stagger
    : Math.max(k * times.stagger, throwAt(k - IN_FLIGHT, times) + times.travel);
}
export const thrown = (n: number, times: ThrowTimes): number =>
  throwAt(Math.max(1, n) - 1, times) + times.flick;

/** How squashed Aski is at t, 0..1: one pulse a stream, up and back over `flick`. */
export function squashAt(t: number, n: number, times: ThrowTimes): number {
  let most = 0;
  for (let k = 0; k < Math.max(1, n); k++) {
    const u = (t - throwAt(k, times)) / times.flick;
    if (u > 0 && u < 1) most = Math.max(most, Math.sin(Math.PI * u));
  }
  return most;
}

/**
 * The throw: `n` streams, `looks` the way to each one's pane in canon
 * units (none, or fewer, keeps those eyes home), in the order they leave.
 */
export function theThrow(
  n: number,
  looks: readonly (readonly [number, number])[],
  times: ThrowTimes,
  seed = 7,
): SceneCard {
  const done = thrown(n, times),
    end = done + HOLD;

  function frame(t: number, stage: Stage): Grid {
    const s = squashAt(t, n, times);
    if (s === 0) return cloudAtRest(stage);
    // A pulse: the cloud squashes a row toward its feet, a little wider, and springs back.
    const home = homeFit(stage),
      tall = BODY_HEIGHT * home.ky,
      ky = home.ky * Math.max(0, 1 - s / tall);
    const fit = { ...home, ky, kx: home.kx * (1 + (0.5 * s) / tall) };
    const g = makeGrid(stage),
      cells = cloudCells(stage, fit),
      letters = spell(cells, "aski");
    for (const [m, k] of cells.entries())
      put(g, k % stage.cols, Math.floor(k / stage.cols), letters[m]!, 1);
    return g;
  }

  const eyesAt = (t: number, stage: Stage): EyePlace | null => {
    if (t >= done) return null;
    let k = 0;
    while (k + 1 < n && throwAt(k + 1, times) <= t) k++;
    const look = looks[k];
    return look === undefined ? null : eyesLooking(stage, look);
  };
  const mood = (t: number): Mood | undefined => (t >= done ? "pleased" : undefined);

  return {
    id: "the-throw",
    seed,
    beats: { out: 0, thrown: done },
    end,
    still: done,
    lines: [],
    home: true,
    eyes: (t) => (t === done ? 1 : blinkAt(t, seed)),
    eyesAt,
    mood,
    frame,
  };
}

/** The way from Aski's middle to a pane's, as the eyes look: `LOOK` long, in canon units, from a vector in pixels. */
export function lookToward(dx: number, dy: number): readonly [number, number] {
  const d = Math.hypot(dx, dy);
  return d === 0 ? [0, 0] : [(dx / d) * LOOK, (dy / d) * LOOK];
}
