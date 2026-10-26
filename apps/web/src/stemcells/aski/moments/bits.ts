// Seven bits: clicked seven times, Aski comes apart into every character
// seven bits can print, laid out in order, looks them over, and gathers
// back into its cloud.

import { type Grid, makeGrid, put, type Stage } from "../grid.ts";
import { ease, lerp, sstep, unlerp } from "../math.ts";
import { BODY_HEIGHT, EYES } from "../canon.ts";
import {
  BODY_MID,
  BODY_WIDTH,
  cloudAtRest,
  cloudCells,
  homeFit,
  type SceneCard,
  spell,
} from "../scene.ts";
import words from "../strings/en.json" with { type: "json" };
import { blinkFrom, eyesLooking, middleOf, squareOf } from "./stage.ts";

/** Seconds: out from `out` until `laid`, back from `back` until `home`; the line from `say`. */
export const BITS = { out: 0.4, laid: 1.6, back: 4.2, home: 5.4, say: 5.8, end: 9.6 } as const;

/** Every printable character seven bits hold, in order, the space first. */
const PRINTABLE = Array.from({ length: 95 }, (_, n) => String.fromCharCode(32 + n));
/** The table they are laid out in: this many to a row, and no wider than Aski's square, while the rows fit above Aski's feet. */
const PER_ROW = 19;
/** How far down the eyes look while the table holds, canon units. */
const LOOK_DOWN = 6;

/**
 * Where character `n` lands in the table on a stage, in cells: under the eyes and no lower than
 * the cloud's last row, so none hides behind them or falls below Aski's feet; every other row
 * while they fit. A stage too short for the rows (a 1x screen has half) widens the table to
 * the left instead.
 */
function placeIn(stage: Stage): (n: number) => readonly [number, number] {
  const fit = homeFit(stage);
  const eyesFoot = (EYES.centers[0][1] + LOOK_DOWN + EYES.height / 2) * fit.ky + fit.ground;
  const top = Math.ceil(eyesFoot + 0.5),
    bottom = squareOf(stage).bottom;
  const square = Math.max(
    1,
    Math.min(PER_ROW, Math.floor(Math.max(BODY_WIDTH, BODY_HEIGHT) * fit.kx)),
  );
  const perRow = Math.max(
    square,
    Math.min(stage.cols, Math.ceil(PRINTABLE.length / Math.max(1, bottom - top + 1))),
  );
  const rows = Math.ceil(PRINTABLE.length / perRow);
  const step = top + (rows - 1) * 2 <= bottom ? 2 : 1;
  // Centred under the eyes; a wider table keeps the square's right edge and grows to the left, clear of the line.
  const [mx] = middleOf(stage, [BODY_MID.x, BODY_MID.y]),
    right = mx + (square - 1) / 2;
  return (n) => [right - (perRow - 1) + (n % perRow), top + Math.floor(n / perRow) * step];
}

export function bits(seed = 7): SceneCard {
  function frame(t: number, stage: Stage): Grid {
    if (t <= BITS.out || t >= BITS.home) return cloudAtRest(stage);
    const g = makeGrid(stage),
      cells = cloudCells(stage),
      letters = spell(cells, "aski");
    // The rest of the cloud fades as the characters leave it, and fills again as they land.
    const body = 1 - sstep(BITS.out, BITS.out + 0.5, t) + sstep(BITS.home - 0.5, BITS.home, t);
    for (const [n, k] of cells.entries())
      if (body > 0) put(g, k % stage.cols, Math.floor(k / stage.cols), letters[n]!, body);
    const place = placeIn(stage);
    const v =
      t < BITS.back
        ? ease.inOutCubic(unlerp(BITS.out, BITS.laid, t))
        : 1 - ease.inOutCubic(unlerp(BITS.back, BITS.home, t));
    for (const [n, ch] of PRINTABLE.entries()) {
      // Each leaves from its own spot in the cloud, spread over it, and lands in its place in the table.
      const k = cells[Math.floor((n * cells.length) / PRINTABLE.length)] ?? 0;
      const from = [k % stage.cols, Math.floor(k / stage.cols)] as const;
      const to = place(n);
      put(g, Math.round(lerp(from[0], to[0], v)), Math.round(lerp(from[1], to[1], v)), ch, 1);
    }
    return g;
  }

  return {
    id: "bits",
    seed,
    beats: { ...BITS },
    end: BITS.end,
    still: 3,
    lines: [words["moment.bits"]],
    home: true,
    // The eyes stay where they were and look the table over.
    eyes: (t) => Math.min(blinkFrom(t, 3.0), blinkFrom(t, 6.4)),
    eyesAt: (t, stage) => {
      const look = sstep(BITS.laid, BITS.laid + 0.3, t) - sstep(BITS.back - 0.3, BITS.back, t);
      return look > 0 ? eyesLooking(stage, [0, LOOK_DOWN * look]) : null;
    },
    frame,
  };
}
