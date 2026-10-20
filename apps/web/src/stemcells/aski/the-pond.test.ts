import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { type Grid, isEmpty, printGrid, sameGrid } from "./grid.ts";
import { cloudAtRest } from "./scene.ts";
import { POND, thePond } from "./scenes/the-pond.ts";

const STAGE = { cols: 96, rows: 28 };
const warm = (g: Grid) => g.cells.filter((c) => c.tone === "warm" && !isEmpty(c));
const koiLetters = (g: Grid) => warm(g).filter((c) => /[koiKOI]/.test(c.ch)).length;

test("the pond opens on Aski at rest and ends with it at home, on any stage", () => {
  for (const stage of [
    STAGE,
    { cols: 60, rows: 18 },
    { cols: 140, rows: 40 },
    { cols: 30, rows: 8 },
    { cols: 200, rows: 30 },
  ]) {
    const card = thePond(),
      home = cloudAtRest(stage),
      name = `${stage.cols}x${stage.rows}`;
    NodeAssert.deepEqual(card.frame(0, stage), home, `${name}: it opens on the cloud at rest`);
    NodeAssert.deepEqual(card.frame(card.beats.home!, stage), home, `${name}: home by its beat`);
    NodeAssert.deepEqual(card.frame(card.end, stage), home, `${name}: and at its end`);
    for (const t of [POND.fill + 0.5, 5, card.still, POND.cloud])
      NodeAssert.ok(!sameGrid(card.frame(t, stage), home), `${name}: not home at ${t}`);
  }
});

test("the pond says one line of eight words at most, and the host types it, not the grid", () => {
  const card = thePond();
  NodeAssert.equal(card.lines.length, 1);
  const words = card.lines[0]!.split(/\s+/);
  NodeAssert.ok(words.length <= 8);
  NodeAssert.ok(
    card.beats.say! < card.still && card.still < card.beats.back!,
    "the line is up on the still",
  );
  for (const t of [card.beats.say!, card.still, card.beats.back! - 0.1]) {
    const print = printGrid(card.frame(t, STAGE));
    for (const word of words.map((w) => w.replace(/\W+$/, "")).filter((w) => w.length > 3))
      NodeAssert.ok(!print.includes(word), `${word} at ${t}`);
  }
});

test("the koi is the one warm thing, spelled koi; it dives under the water and rises", () => {
  const card = thePond(),
    at = (t: number) => card.frame(t, STAGE);
  NodeAssert.ok(koiLetters(at(5)) >= 20, `surfaced, it reads koi (${koiLetters(at(5))} letters)`);
  NodeAssert.ok(
    warm(at(5)).every((c) => "koiKOI+-|/\\.*".includes(c.ch)),
    "spelled in its own name, fins and tail in strokes",
  );
  NodeAssert.equal(koiLetters(at(POND.dive + 0.7)), 0, "under the water its letters are gone");
  NodeAssert.ok(koiLetters(at(POND.rise + 1)) >= 20, "and back when it rises");
  NodeAssert.equal(warm(at(card.still)).length, 0, "gone once she rises");
  NodeAssert.equal(warm(cloudAtRest(STAGE)).length, 0);
});

test("she rises face first, spelled in her name, and holds still once whole", () => {
  const card = thePond(),
    whole = card.frame(card.beats.say!, STAGE);
  const letters = whole.cells
    .filter((c) => /[a-zA-Z]/.test(c.ch))
    .map((c) => c.ch)
    .join("");
  NodeAssert.ok(
    letters.length > 150 && /^[monalisaMONALISA]+$/.test(letters),
    "every letter of her is her name",
  );
  NodeAssert.ok(letters.includes("MONALISA"), "and it reads");
  // Rising, her face is in before her edges.
  const rising = card.frame(POND.paint + 1, STAGE),
    capitals = (cells: readonly { ch: string }[]) => cells.filter((c) => /[A-Z]/.test(c.ch)).length;
  NodeAssert.ok(capitals(rising.cells.slice(0, 12 * STAGE.cols)) > 0, "her face is in");
  NodeAssert.equal(capitals(rising.cells.slice(-6 * STAGE.cols)), 0, "before her dress");
  // Nothing churns: from whole until she starts to go, just before the line does, not one cell changes.
  NodeAssert.deepEqual(
    card.frame(card.beats.say! + 0.1, STAGE),
    card.frame(card.beats.back! - 0.35, STAGE),
  );
});

test("Aski's eyes are open at home when the pond opens and ends, and shut wherever they change place", () => {
  const card = thePond(),
    eyesAt = card.eyesAt!;
  for (const t of [0, card.end]) {
    NodeAssert.equal(card.eyes(t), 1, `open at ${t}`);
    NodeAssert.equal(eyesAt(t, STAGE), null, `at home at ${t}`);
  }
  // A host draws the eyes where the scene says; where that place changes they are shut, so they never jump.
  const step = 1 / 120;
  for (let t = 0; t < card.end; t += step) {
    if ((eyesAt(t, STAGE) === null) !== (eyesAt(t + step, STAGE) === null))
      NodeAssert.ok(
        Math.max(card.eyes(t), card.eyes(t + step)) < 0.1,
        `shut as they move at ${t.toFixed(3)}`,
      );
  }
});
