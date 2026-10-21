// What Aski's moments share on a stage: Aski at rest where the figure
// stands, its cloud thinned for a while, its eyes looking somewhere, one
// blink at a moment. Every moment opens and ends on Aski at rest
// (`cloudAtRest`), so the figure fades out under it and back without a seam.

import { BLINK } from "../acts.ts";
import { EYES } from "../canon.ts";
import { type Grid, makeGrid, put, type Stage } from "../grid.ts";
import { hash, lerp } from "../math.ts";
import { cloudCells, type EyePlace, homeFit, spell } from "../scene.ts";

/** How open the eyes are through one blink starting at `at`, the canon's blink: shut over `close`, open over `open`. */
export function blinkFrom(t: number, at: number): number {
  const { close, open, shut } = BLINK;
  const u = t - at;
  if (u < 0 || u >= close + open) return 1;
  return u < close ? lerp(1, shut, u / close) : lerp(shut, 1, (u - close) / open);
}

/**
 * Aski at rest, `thin` of its cells gone faint: a seeded share of them, so
 * the same cells fade each frame and a thinning grows from those already
 * faint. 0 is the cloud at rest.
 */
export function thinCloud(stage: Stage, thin: number, seed: number): Grid {
  const g = makeGrid(stage),
    cells = cloudCells(stage),
    letters = spell(cells, "aski");
  for (const [n, k] of cells.entries()) {
    const i = k % stage.cols,
      j = Math.floor(k / stage.cols),
      h = hash(seed, i, j, 5);
    if (h >= thin) put(g, i, j, letters[n]!, 1);
    else if (h >= thin * 0.5) put(g, i, j, ".", 0.5);
  }
  return g;
}

/** Aski's eyes at home looking `look` away, in canon units (the figure's gaze reaches `GAZE`), as a scene places eyes. */
export function eyesLooking(stage: Stage, look: readonly [number, number]): EyePlace {
  const fit = homeFit(stage);
  const at = EYES.centers.map(
    ([x, y]) => [(x + look[0]) * fit.kx + fit.cx, (y + look[1]) * fit.ky + fit.ground] as const,
  );
  return { at: [at[0]!, at[1]!], rows: EYES.height * fit.ky };
}

/** Where Aski's middle falls on a stage, in cells (column, row). */
export function middleOf(stage: Stage, [x, y]: readonly [number, number]): [number, number] {
  const fit = homeFit(stage);
  return [x * fit.kx + fit.cx, y * fit.ky + fit.ground];
}
