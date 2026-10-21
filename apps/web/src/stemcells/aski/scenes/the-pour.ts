// The pour, Aski's half of a spawn before the bud. The message's letters stream
// into the cloud from the left while the cloud dims around them, then go round
// inside it on three orbits while the Cells are planned. It goes round until
// the plan is in; the bud carries on from Aski at rest. The still is the
// message gathered inside.

import { blinkAt } from "../acts.ts";
import { BODY_HEIGHT } from "../canon.ts";
import { type Grid, isPrintable, makeGrid, put, type Stage } from "../grid.ts";
import { clamp, ease, hash, lerp } from "../math.ts";
import {
  BODY_MID,
  BODY_WIDTH,
  cellToCanon,
  cloudCells,
  type Fit,
  homeFit,
  inCloud,
  type SceneCard,
  spell,
} from "../scene.ts";

/**
 * Seconds: each letter flies for `fly`, the last one leaves at `spread`, and
 * the orbits start once all are in; an orbit goes round in `turn`. The cloud
 * dims to `dim` as the letters come, so they read over it. The message gives
 * `most` letters at most; the pour goes round for `hold` at most, then holds.
 */
export const POUR = { fly: 0.5, spread: 0.6, turn: 3.2, dim: 0.4, most: 30, hold: 120 } as const;

/** When the letters are all in and the orbits start. */
export const POURED = POUR.spread + POUR.fly;

/** The orbits, as parts of the cloud's half width and height. */
const ORBITS = [0.3, 0.56, 0.82] as const;

/** The letters a message pours in: its printable ones, spaces dropped, `most` at most; Aski's name when it has none. */
export function pourLetters(text: string): string[] {
  const letters = [...text].filter((c) => isPrintable(c) && c !== " ").slice(0, POUR.most);
  return letters.length > 0 ? letters : [..."aski"];
}

interface Orbiter {
  readonly orbit: number;
  /** Where it starts round, radians. */
  readonly from: number;
  /** The row it comes in on, at the stage's left edge. */
  readonly row: number;
}

interface Pour {
  readonly fit: Fit;
  readonly cells: readonly number[];
  readonly spelled: readonly string[];
  readonly orbiters: readonly Orbiter[];
}

/** Letters per orbit, as many as each orbit is long. */
function shares(n: number): number[] {
  const total = ORBITS.reduce((a, r) => a + r, 0);
  const out = ORBITS.map((r) => Math.floor((n * r) / total));
  for (let k = ORBITS.length - 1; out.reduce((a, c) => a + c, 0) < n; k = (k + 2) % 3) out[k]!++;
  return out;
}

function plan(stage: Stage, n: number, seed: number): Pour {
  const fit = homeFit(stage),
    cells = cloudCells(stage, fit),
    mid = fit.ground - (BODY_HEIGHT / 2) * fit.ky;
  const orbiters: Orbiter[] = [];
  shares(n).forEach((count, orbit) => {
    for (let m = 0; m < count; m++)
      orbiters.push({
        orbit,
        from: ((m + hash(seed, orbit, 21) * 0.5) / count) * 2 * Math.PI,
        row: clamp(
          Math.round(mid + (hash(seed, orbiters.length, 22) - 0.5) * 6),
          0,
          stage.rows - 1,
        ),
      });
  });
  return { fit, cells, spelled: spell(cells, "aski"), orbiters };
}

/** Where orbiter `o` stands `u` seconds into the round, in cells, kept inside the cloud. */
function orbitAt(fit: Fit, o: Orbiter, u: number): readonly [number, number] {
  const dir = o.orbit % 2 === 0 ? 1 : -1,
    angle = o.from + (dir * 2 * Math.PI * u) / POUR.turn;
  for (let r = ORBITS[o.orbit]!; ; r *= 0.85) {
    const x = BODY_MID.x + Math.cos(angle) * r * (BODY_WIDTH / 2),
      y = BODY_MID.y + Math.sin(angle) * r * (BODY_HEIGHT / 2);
    const i = Math.round(fit.cx + x * fit.kx - 0.5),
      j = Math.round(fit.ground + y * fit.ky - 0.5);
    if (inCloud(...cellToCanon(fit, i, j)) || r < 0.1) return [i, j];
  }
}

export function thePour(text: string, seed = 7): SceneCard {
  const letters = pourLetters(text);
  const plans = new Map<string, Pour>(); // derived from the stage, letters and seed alone, so keeping them changes no frame
  const planFor = (s: Stage) => {
    const key = `${s.cols}x${s.rows}`;
    let p = plans.get(key);
    if (!p) {
      p = plan(s, letters.length, seed);
      plans.set(key, p);
    }
    return p;
  };
  const leaves = (n: number) =>
    letters.length === 1 ? 0 : (POUR.spread * n) / (letters.length - 1);
  const end = POURED + POUR.hold;

  function frame(t: number, stage: Stage): Grid {
    const p = planFor(stage),
      g = makeGrid(stage);
    // The cloud dims as the letters come, so they read over it.
    const ink = lerp(1, POUR.dim, ease.inOutCubic(clamp(t / POURED, 0, 1)));
    p.cells.forEach((c, n) =>
      put(g, c % stage.cols, Math.floor(c / stage.cols), p.spelled[n]!, ink),
    );
    const u = Math.min(t, end) - POURED;
    p.orbiters.forEach((o, n) => {
      const [ti, tj] = orbitAt(p.fit, o, Math.max(0, u));
      const f = (t - leaves(n)) / POUR.fly;
      if (f < 0) return;
      if (f >= 1) return put(g, ti, tj, letters[n]!, 1);
      // In from past the left edge, on a low arc.
      const e = ease.inOutCubic(f),
        i = lerp(-1, ti, e),
        j = lerp(o.row, tj, e) - 2 * Math.sin(Math.PI * e);
      put(g, Math.round(i), Math.round(j), letters[n]!, 1);
    });
    return g;
  }

  return {
    id: "the-pour",
    seed,
    beats: { pour: 0, around: POURED },
    end,
    still: POURED,
    lines: [], // the message is the person's own; Aski says nothing over it
    home: true,
    eyes: (t) => (t === POURED ? 1 : blinkAt(t, seed)),
    frame,
  };
}
