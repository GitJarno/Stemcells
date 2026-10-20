import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { crossfade, type Grid, isEmpty, makeGrid, put, sameGrid } from "./grid.ts";
import { cloudAtRest, cloudCells } from "./scene.ts";
import { theBud } from "./scenes/the-bud.ts";
import { theRain } from "./scenes/the-rain.ts";
import { SCENE_CARDS } from "./scenes.ts";

const STAGE = { cols: 96, rows: 28 };

test("a frame depends on seed, stage and time alone", () => {
  for (const [id, make] of Object.entries(SCENE_CARDS)) {
    const card = make(),
      times = [0, 0.7, 2.6, card.still / 2, card.still];
    const first = times.map((t) => card.frame(t, STAGE));
    // Asked again backwards, after another stage, and of a fresh card: the same grids.
    card.frame(1.3, { cols: 40, rows: 12 });
    for (let n = times.length - 1; n >= 0; n--)
      NodeAssert.deepEqual(card.frame(times[n]!, STAGE), first[n], `${id} at ${times[n]}`);
    const fresh = make();
    for (const [n, t] of times.entries())
      NodeAssert.deepEqual(fresh.frame(t, STAGE), first[n], `${id} at ${t}, fresh`);
  }
});

test("two seeds rain differently", () => {
  for (const t of [0.5, 2.6])
    NodeAssert.ok(!sameGrid(theRain(7).frame(t, STAGE), theRain(8).frame(t, STAGE)), `at ${t}`);
});

test("the rain ends with Aski at home, on any stage", () => {
  for (const stage of [
    STAGE,
    { cols: 60, rows: 18 },
    { cols: 140, rows: 40 },
    { cols: 30, rows: 8 },
  ]) {
    const card = theRain(),
      home = cloudAtRest(stage);
    NodeAssert.deepEqual(card.frame(card.end, stage), home, `${stage.cols}x${stage.rows}`);
    NodeAssert.ok(
      !sameGrid(card.frame(card.beats.cond!, stage), home),
      "and not before the letters close",
    );
  }
});

test("the cloud at rest is spelled aski, at full ink", () => {
  const g = cloudAtRest(STAGE),
    cells = cloudCells(STAGE);
  NodeAssert.ok(cells.length > 200);
  NodeAssert.equal(
    cells.map((k) => g.cells[k]!.ch).join(""),
    "aski".repeat(cells.length).slice(0, cells.length),
  );
  NodeAssert.ok(cells.every((k) => g.cells[k]!.ink === 1));
});

test("every line is eight words at most, and the still shows Aski awake", () => {
  for (const [id, make] of Object.entries(SCENE_CARDS)) {
    const card = make();
    for (const line of card.lines)
      NodeAssert.ok(line.trim().split(/\s+/).length <= 8, `${id}: ${line}`);
    NodeAssert.ok(
      card.still >= 0 && card.still <= card.end,
      `${id}: the still is inside the scene`,
    );
    NodeAssert.equal(card.eyes(card.still), 1, `${id}: its eyes are open on the still`);
  }
});

/** The pieces of a grid where `keep` holds, touching on sides or corners, each in reading order. */
function pieces(g: Grid, keep: (k: number) => boolean): number[][] {
  const seen = new Set<number>(),
    out: number[][] = [];
  for (let k0 = 0; k0 < g.cells.length; k0++) {
    if (seen.has(k0) || !keep(k0)) continue;
    const piece: number[] = [],
      todo = [k0];
    seen.add(k0);
    while (todo.length) {
      const k = todo.pop()!,
        i = k % g.cols,
        j = (k - i) / g.cols;
      piece.push(k);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ni = i + di,
            nj = j + dj,
            nk = nj * g.cols + ni;
          if (ni >= 0 && nj >= 0 && ni < g.cols && nj < g.rows && !seen.has(nk) && keep(nk)) {
            seen.add(nk);
            todo.push(nk);
          }
        }
    }
    out.push(piece.sort((a, b) => a - b));
  }
  return out;
}

test("the bud buds one small cloud per task word, spelled in it, and leaves Aski at home", () => {
  const words = ["tests", "docs", "fix"],
    card = theBud(words),
    g = card.frame(card.still, STAGE);
  const body = new Set(cloudCells(STAGE)),
    home = cloudAtRest(STAGE);
  const read = pieces(g, (k) => !body.has(k) && !isEmpty(g.cells[k]!)).map((p) =>
    p.map((k) => g.cells[k]!.ch).join(""),
  );
  NodeAssert.equal(read.length, 3, read.join(" | "));
  for (const w of words) {
    const bud = read.filter(
      (r) => r.length >= w.length && r === w.repeat(r.length).slice(0, r.length),
    );
    NodeAssert.equal(bud.length, 1, `one bud spells ${w}: ${read.join(" | ")}`);
  }
  for (const k of body) NodeAssert.deepEqual(g.cells[k], home.cells[k], "Aski is untouched");
  NodeAssert.deepEqual(card.frame(0, STAGE), home, "and it opens on Aski at rest");
});

test("the bud buds one to four Cells, each one word", () => {
  NodeAssert.throws(() => theBud([]), RangeError);
  NodeAssert.throws(() => theBud(["a", "b", "c", "d", "e"]), RangeError);
  NodeAssert.throws(() => theBud(["two words"]), RangeError);
  for (const n of [1, 2, 4]) {
    const words = ["lint", "docs", "fix", "tests"].slice(0, n),
      card = theBud(words),
      body = new Set(cloudCells(STAGE));
    const g = card.frame(card.still, STAGE);
    NodeAssert.equal(
      pieces(g, (k) => !body.has(k) && !isEmpty(g.cells[k]!)).length,
      n,
      `${n} buds`,
    );
  }
});

test("a crossfade runs from one grid to the other, cell by cell", () => {
  const a = cloudAtRest(STAGE),
    b = makeGrid(STAGE);
  for (const k of cloudCells(STAGE)) put(b, k % STAGE.cols, Math.floor(k / STAGE.cols), "x", 0.5);
  put(b, 0, 0, "#", 1);
  NodeAssert.deepEqual(crossfade(a, b, 0), a);
  NodeAssert.deepEqual(crossfade(a, b, 1), b);
  const mid = crossfade(a, b, 0.5, 3),
    body = cloudCells(STAGE);
  NodeAssert.ok(
    body.every((k) => mid.cells[k]!.ink === 0.75),
    "ink blends",
  );
  const turned = body.filter((k) => mid.cells[k]!.ch === "x").length;
  NodeAssert.ok(
    turned > body.length * 0.3 && turned < body.length * 0.7,
    `halfway, about half the cells have turned (${turned} of ${body.length})`,
  );
  NodeAssert.deepEqual(
    mid.cells[0],
    { ch: "#", ink: 0.5 },
    "a cell coming from nothing is its new character, fading in",
  );
});
