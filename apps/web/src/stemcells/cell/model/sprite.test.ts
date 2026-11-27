import { describe, expect, it } from "vite-plus/test";

import { type Act, poseAt } from "./acts.ts";
import { figureOf, PIECES } from "./body.ts";
import { drawSprite, faceView, type Sprite, wholeView } from "./sprite.ts";
import { INK } from "./tones.ts";

const HUE = [255, 129, 84] as const;

const alphaAt = (sprite: Sprite, x: number, y: number) =>
  sprite.pixels[(y * sprite.width + x) * 4 + 3]!;

const isInk = (sprite: Sprite, at: number) =>
  sprite.pixels[at * 4] === INK[0] &&
  sprite.pixels[at * 4 + 1] === INK[1] &&
  sprite.pixels[at * 4 + 2] === INK[2] &&
  sprite.pixels[at * 4 + 3] === 255;

/** The columns holding eye ink, as runs: one run an eye. */
function eyeRuns(sprite: Sprite): number {
  const columns = Array.from({ length: sprite.width }, (_, x) =>
    Array.from({ length: sprite.height }, (_, y) => isInk(sprite, y * sprite.width + x)).some(
      Boolean,
    ),
  );
  return columns.filter((inked, x) => inked && columns[x - 1] !== true).length;
}

const drawn = (act: Act, ms: number, grown: number, rows: number, yaw = 0, from?: Act) =>
  drawSprite(figureOf(poseAt(act, ms, grown, from)), wholeView(grown, rows, yaw), HUE);

describe("the model's sprite", () => {
  it.each([
    [0, 16],
    [0, 32],
    [0, 64],
    [1, 32],
    [1, 64],
  ])("shows both eyes from the front, grown %d at %d rows", (grown, rows) => {
    expect(eyeRuns(drawn("rest", 1000, grown, rows))).toBe(2);
  });

  it("draws a newborn as a mochi seen from the front: widest where it sits, its eyes either side of its middle", () => {
    const sprite = drawn("rest", 1000, 0, 32);
    const solid = (x: number, y: number) => alphaAt(sprite, x, y) === 255;
    const columns = Array.from({ length: sprite.width }, (_, x) => x);
    const rows = Array.from({ length: sprite.height }, (_, y) => y)
      .map((y) => columns.filter((x) => solid(x, y)))
      .filter((row) => row.length > 0);
    const widths = rows.map((row) => row.length);
    const widest = Math.max(...widths);
    // An egg is widest at its middle; a mochi stays as wide down to its foot.
    expect(widths.lastIndexOf(widest)).toBeGreaterThan(rows.length * 0.75);
    const inked = columns.filter((x) =>
      Array.from({ length: sprite.height }, (_, y) => isInk(sprite, y * sprite.width + x)).some(
        Boolean,
      ),
    );
    const base = rows[widths.indexOf(widest)]!;
    const middle = (base[0]! + base.at(-1)!) / 2;
    expect(Math.abs((inked[0]! + inked.at(-1)!) / 2 - middle)).toBeLessThanOrEqual(0.5);
  });

  it("shows no eyes from behind", () => {
    expect(eyeRuns(drawn("rest", 1000, 1, 64, Math.PI))).toBe(0);
  });

  it.each([0, 0.5, 1])("keeps both eyes clear of the lid while it writes, grown %d", (grown) => {
    expect(eyeRuns(drawn("writing", 2500, grown, 64))).toBe(2);
  });

  it.each([0, 1])("outlines the whole figure, grown %d", (grown) => {
    const sprite = drawn("writing", 2500, grown, 64);
    const bare: string[] = [];
    for (let y = 1; y < sprite.height - 1; y++)
      for (let x = 1; x < sprite.width - 1; x++) {
        if (alphaAt(sprite, x, y) !== 0) continue;
        const beside = [alphaAt(sprite, x - 1, y), alphaAt(sprite, x + 1, y)];
        if (beside.includes(255) && beside.includes(0)) continue;
        if (beside.every((alpha) => alpha === 255)) bare.push(`${x},${y}`);
      }
    expect(bare).toEqual([]);
  });

  it.each([
    ["landed", 0],
    ["landed", 1],
    ["asking", 0],
    ["asking", 1],
  ] as const)("keeps %s inside the picture all the way through, grown %d", (act, grown) => {
    const cut: number[] = [];
    for (let ms = 0; ms <= 2000; ms += 100) {
      const sprite = drawn(act, ms, grown, 32, 0.45, "writing");
      const edge = Array.from({ length: sprite.width }, (_, x) => alphaAt(sprite, x, 0)).concat(
        Array.from({ length: sprite.height }, (_, y) => alphaAt(sprite, 0, y)),
        Array.from({ length: sprite.height }, (_, y) => alphaAt(sprite, sprite.width - 1, y)),
      );
      if (edge.includes(255)) cut.push(ms);
    }
    expect(cut).toEqual([]);
  });

  it("draws every piece without hiding the eyes", () => {
    const worn = PIECES.filter((piece) => piece !== "specs");
    for (const grown of [0, 1]) {
      const sprite = drawSprite(
        figureOf(poseAt("rest", 1000, grown), worn),
        wholeView(grown, 64, 0),
        HUE,
      );
      expect(eyeRuns(sprite)).toBe(2);
    }
  });

  it("frames the face in a small place", () => {
    const pose = poseAt("writing", 2500, 1);
    const sprite = drawSprite(figureOf(pose), faceView(1, pose.lift, 16), HUE);
    expect(eyeRuns(sprite)).toBe(2);
  });
});
