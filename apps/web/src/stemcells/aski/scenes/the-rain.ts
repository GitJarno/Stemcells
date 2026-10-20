// The rain, for a first launch. Letters rain over an empty stage; the ones that
// fall on Aski's shape stay, spelling `aski`; the rain thins, the letters close
// into the cloud at full ink, and it opens its eyes.

import { blinkAt } from "../acts.ts";
import { type Grid, makeGrid, put, type Stage } from "../grid.ts";
import { ease, hash, lerp, sstep } from "../math.ts";
import { cloudCells, type SceneCard, spell } from "../scene.ts";
import { RAIN, SCENE_TIMES } from "./times.ts";

export { RAIN } from "./times.ts";

/** What the rain is made of: every printable character but the space. */
const DROPS = Array.from({ length: 94 }, (_, n) => String.fromCharCode(33 + n)).join("");

interface Stream {
  readonly i: number;
  readonly t0: number;
  /** The head's row at t0 (above the stage), its speed in rows a second, its length in cells. */
  readonly y0: number;
  readonly v: number;
  readonly len: number;
  readonly k: number;
}

interface Lock {
  readonly i: number;
  readonly j: number;
  readonly at: number;
  readonly ch: string;
}

interface Layout {
  readonly streams: readonly Stream[];
  readonly locks: readonly Lock[];
  /** When each cell of the stage locks into Aski; Infinity off its body. */
  readonly lockAt: Float64Array;
}

function layout(seed: number, stage: Stage): Layout {
  const { cols, rows } = stage,
    streams: Stream[] = [];
  // As many streams per column on any stage, crossing it in the same time.
  const every = 1.265 / cols,
    pace = rows / 26;
  for (let n = 0; n * every < RAIN.stop; n++) {
    const t = n * every;
    if (hash(seed, n, 0) > lerp(1, 0.25, t / RAIN.stop)) continue; // dense at first, thinning towards the stop
    streams.push({
      i: Math.floor(hash(seed, n, 1) * cols),
      t0: t,
      y0: -Math.floor(hash(seed, n, 2) * 6),
      v: (15 + hash(seed, n, 3) * 13) * pace,
      len: Math.max(2, Math.round((8 + Math.floor(hash(seed, n, 4) * 14)) * pace)),
      k: hash(seed, n, 5) * 1000,
    });
  }
  const byCol = Array.from({ length: cols }, () => [] as Stream[]);
  for (const st of streams) byCol[st.i]!.push(st);
  // A cell of Aski locks the first time a stream's head reaches it once the forming
  // begins; a cell no stream reaches in time settles in just before the letters close.
  const cells = cloudCells(stage),
    letters = spell(cells, "aski"),
    lockAt = new Float64Array(cols * rows).fill(Infinity);
  const locks = cells.map((idx, n): Lock => {
    const i = idx % cols,
      j = (idx - i) / cols;
    let at = Infinity;
    for (const st of byCol[i]!) {
      const tt = st.t0 + (j - st.y0) / st.v;
      if (tt >= RAIN.form && tt < at) at = tt;
    }
    if (!(at <= RAIN.cond - 0.2)) at = RAIN.cond - 0.9 + hash(seed, i, j, 9) * 0.6;
    lockAt[idx] = at;
    return { i, j, at, ch: letters[n]! };
  });
  return { streams, locks, lockAt };
}

export function theRain(seed = 7): SceneCard {
  const layouts = new Map<string, Layout>(); // derived from (seed, stage) alone, so keeping them changes no frame
  const layoutFor = (s: Stage) => {
    const key = `${s.cols}x${s.rows}`;
    let l = layouts.get(key);
    if (!l) {
      l = layout(seed, s);
      layouts.set(key, l);
    }
    return l;
  };

  function frame(t: number, stage: Stage): Grid {
    const L = layoutFor(stage),
      g = makeGrid(stage),
      solid = sstep(RAIN.cond, RAIN.cond + 0.8, t);
    // Aski: every cell a drop has reached, lit as it locks, then settling, and all at full ink once closed.
    for (const c of L.locks) {
      if (t < c.at) continue;
      const lit = 0.62 + 0.38 * (1 - sstep(c.at, c.at + 0.6, t));
      put(g, c.i, c.j, c.ch, solid >= 1 ? 1 : lerp(lit, 1, solid));
    }
    // The rain, falling past it and through the cells not yet locked.
    for (const st of L.streams) {
      const head = (t - st.t0) * st.v + st.y0;
      if (head < 0 || head - st.len >= stage.rows) continue;
      const hj = Math.floor(head),
        step = Math.floor(t * 9 + st.k);
      for (let k = 0; k < st.len; k++) {
        const j = hj - k,
          idx = j * stage.cols + st.i;
        if (j < 0 || j >= stage.rows || L.lockAt[idx]! <= t) continue;
        const ink = k === 0 ? 1 : 0.62 * (1 - k / st.len) ** 1.6;
        if (ink <= g.cells[idx]!.ink) continue;
        // The head churns; the tail keeps its letters a while.
        const roll = k === 0 ? step : Math.floor(st.k) + (step >> 3);
        put(
          g,
          st.i,
          j,
          DROPS[Math.floor(hash(seed, st.i * 13 + j, roll, 11) * DROPS.length)]!,
          ink,
        );
      }
    }
    return g;
  }

  return {
    id: "the-rain",
    seed,
    beats: { form: RAIN.form, stop: RAIN.stop, cond: RAIN.cond, open: RAIN.open, say: RAIN.say },
    end: RAIN.end,
    still: SCENE_TIMES["the-rain"]!.still,
    lines: [SCENE_TIMES["the-rain"]!.line],
    home: false,
    // Shut while it forms, open once it is whole, and open on the still.
    eyes: (t) =>
      t < RAIN.cond
        ? 0
        : t >= RAIN.end
          ? 1
          : Math.min(
              t < RAIN.open
                ? 0.06
                : 0.06 + 0.94 * ease.inOutCubic(sstep(RAIN.open, RAIN.open + 0.35, t)),
              blinkAt(t, seed),
            ),
    frame,
  };
}
