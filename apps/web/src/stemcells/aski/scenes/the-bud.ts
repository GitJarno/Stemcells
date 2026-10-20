// The bud, the default act after you send. Aski at rest buds one small cloud per
// Cell, spelled in its task word: each swells out of its side, pinches off with a
// puff and drifts to its place. It lasts about as long as a start takes, and ends
// with every bud in its place and Aski at home.

import { blinkAt } from "../acts.ts";
import { BODY_HEIGHT } from "../canon.ts";
import { cellAt, type Grid, isEmpty, put, type Stage } from "../grid.ts";
import { clamp, ease, hash, lerp } from "../math.ts";
import {
  BODY_MID,
  BODY_WIDTH,
  cellToCanon,
  cloudAtRest,
  type Fit,
  homeFit,
  inCloud,
  type SceneCard,
  spell,
} from "../scene.ts";

/** Seconds into each bud's own part: it swells until `swell`, pinches off at `pinch`, lands at `land`. Buds follow each other by `stagger`. */
export const BUD = {
  swell: 0.45,
  pinch: 0.5,
  land: 1.15,
  puff: 0.35,
  stagger: 0.12,
  hold: 0.35,
} as const;

/** A small cloud: Aski's own field at a smaller scale, laid on cells around its centre (0, 0). */
interface Lattice {
  /** Cell offsets from the centre, in reading order, and the letter each shows. */
  readonly cells: readonly (readonly [number, number])[];
  readonly letters: readonly string[];
  readonly fit: Fit;
  readonly halfW: number;
  readonly halfH: number;
}

/** The fit of a cloud `s` times Aski's size whose middle sits on the centre of cell (0, 0). */
function budFit(home: Fit, s: number): Fit {
  const kx = home.kx * s,
    ky = home.ky * s;
  return { cx: 0.5 - BODY_MID.x * kx, ground: 0.5 - BODY_MID.y * ky, kx, ky };
}

/** Inside the small cloud grown to `g` of its size, about its middle. */
function inBud(fit: Fit, di: number, dj: number, g: number): boolean {
  const [x, y] = cellToCanon(fit, di, dj);
  return inCloud(BODY_MID.x + (x - BODY_MID.x) / g, BODY_MID.y + (y - BODY_MID.y) / g);
}

/** The smallest bud, from a third of Aski's size, with a cell for every letter of its word. */
function lattice(home: Fit, word: string): Lattice {
  for (let m = 0; ; m++) {
    const fit = budFit(home, 0.3 + 0.04 * m);
    const R = Math.ceil((BODY_WIDTH / 2) * fit.kx) + 1,
      H = Math.ceil((BODY_HEIGHT / 2) * fit.ky) + 1;
    const cells: [number, number][] = [];
    for (let dj = -H; dj <= H; dj++)
      for (let di = -R; di <= R; di++) if (inBud(fit, di, dj, 1)) cells.push([di, dj]);
    if (cells.length >= word.length || m >= 8) {
      return {
        cells,
        letters: spell(cells, word),
        fit,
        halfW: Math.max(...cells.map(([di]) => Math.abs(di))),
        halfH: Math.max(...cells.map(([, dj]) => Math.abs(dj))),
      };
    }
  }
}

interface Bud {
  readonly word: string;
  readonly lattice: Lattice;
  readonly side: 1 | -1;
  readonly row: number;
  /** The outermost cell of the cloud on the bud's row, where it grows from. */
  readonly root: number;
  /** The bud's centre column as it starts (inside the cloud), once it has swelled out, and in its place. */
  readonly inner: number;
  readonly attached: number;
  readonly slot: number;
}

/** Buds go to the right and left in turn, stacked on each side around the middle of the cloud. */
function plan(stage: Stage, words: readonly string[]): Bud[] {
  const home = homeFit(stage),
    rest = cloudAtRest(stage),
    lattices = words.map((w) => lattice(home, w));
  const tall = Math.max(...lattices.map((l) => 2 * l.halfH + 1)),
    mid = home.ground - (BODY_HEIGHT / 2) * home.ky;
  return words.map((word, k) => {
    const l = lattices[k]!,
      side = k % 2 === 0 ? 1 : -1,
      onSide = side > 0 ? Math.ceil(words.length / 2) : Math.floor(words.length / 2);
    const row = clamp(
      Math.round(mid + ((k >> 1) - (onSide - 1) / 2) * (tall + 2)),
      0,
      stage.rows - 1,
    );
    let root = side > 0 ? stage.cols - 1 : 0;
    while (root !== Math.round(home.cx) && isEmpty(cellAt(rest, root, row))) root -= side;
    // Its place: halfway from the cloud's side to the stage's edge, clear of both.
    const edge = home.cx + side * (BODY_WIDTH / 2) * home.kx,
      far = (edge + (side > 0 ? stage.cols : 0)) / 2;
    const slot = clamp(
      Math.round(side > 0 ? Math.max(far, edge + l.halfW + 3) : Math.min(far, edge - l.halfW - 3)),
      l.halfW,
      stage.cols - 1 - l.halfW,
    );
    return {
      word,
      lattice: l,
      side,
      row,
      root,
      inner: root - side * Math.round(l.halfW * 0.4),
      attached: root + side * (l.halfW + 1),
      slot,
    };
  });
}

export function theBud(words: readonly string[], seed = 7): SceneCard {
  if (words.length < 1 || words.length > 4)
    throw new RangeError(`The bud buds one to four Cells, not ${words.length}`);
  for (const w of words) spell([], w); // each one word, refused here rather than mid-act
  const plans = new Map<string, Bud[]>(); // derived from the stage and words alone, so keeping them changes no frame
  const planFor = (s: Stage) => {
    const key = `${s.cols}x${s.rows}`;
    let p = plans.get(key);
    if (!p) {
      p = plan(s, words);
      plans.set(key, p);
    }
    return p;
  };
  const end = (words.length - 1) * BUD.stagger + BUD.land + BUD.hold;

  function frame(t: number, stage: Stage): Grid {
    const g = cloudAtRest(stage);
    planFor(stage).forEach((b, k) => {
      const u = t - k * BUD.stagger,
        L = b.lattice;
      if (u < 0) return;
      let col: number,
        row = b.row,
        grow = 1;
      if (u < BUD.swell) {
        const p = u / BUD.swell;
        grow = ease.outCubic(p);
        col = lerp(b.inner, b.attached, ease.inOutCubic(p));
      } else if (u < BUD.pinch) {
        col = b.attached;
      } else {
        // Off it goes, in a low arc.
        const p = ease.inOutCubic(clamp((u - BUD.pinch) / (BUD.land - BUD.pinch), 0, 1));
        col = lerp(b.attached, b.slot, p);
        row = b.row - 1.5 * Math.sin(Math.PI * p);
      }
      const ci = Math.round(col),
        cj = Math.round(row);
      // The neck: while it is attached, the bud's letters run back into the cloud.
      if (u >= BUD.swell * 0.4 && u < BUD.pinch) {
        for (let i = b.root + b.side, m = 0; (i - ci) * b.side < 0; i += b.side, m++)
          put(g, i, b.row, b.word[m % b.word.length]!, 1);
      }
      if (grow > 0)
        L.cells.forEach(([di, dj], n) => {
          if (grow >= 1 || inBud(L.fit, di, dj, grow)) put(g, ci + di, cj + dj, L.letters[n]!, 1);
        });
      // The puff where it pinched off: a few specks fly out and fade.
      const pu = (u - BUD.pinch) / BUD.puff;
      if (pu >= 0 && pu < 1) {
        const at = b.root + b.side;
        for (let m = 0; m < 6; m++) {
          const a = ((m + 0.5) / 6) * 2 * Math.PI + (hash(seed, k, m, 3) - 0.5),
            r = 0.8 + 2.4 * ease.outCubic(pu);
          const i = Math.round(at + Math.cos(a) * r * 2),
            j = Math.round(b.row + Math.sin(a) * r);
          if (isEmpty(cellAt(g, i, j)))
            put(g, i, j, "*+:."[Math.min(3, Math.floor(pu * 4))]!, 1 - pu);
        }
      }
    });
    return g;
  }

  return {
    id: "the-bud",
    seed,
    beats: { swell: 0, pinch: BUD.pinch, land: (words.length - 1) * BUD.stagger + BUD.land },
    end,
    still: end,
    lines: [], // the act says nothing: the new Cells' first words belong to the birth
    home: true,
    eyes: (t) => (t >= end ? 1 : blinkAt(t, seed)), // blinking while it plays, open on the still
    frame,
  };
}
