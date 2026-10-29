import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { drawFigure, type FigureDrawn } from "./figure.ts";

const ink = [240, 240, 240] as const;
const ground = [10, 10, 10] as const;
const alpha = (pixels: ArrayBuffer): number[] =>
  [...new Uint8ClampedArray(pixels)].filter((_, i) => i % 4 === 3);
const inked = (pixels: ArrayBuffer): number => alpha(pixels).filter((a) => a > 128).length;
const same = (a: ArrayBuffer, b: ArrayBuffer): boolean =>
  new Uint8ClampedArray(a).every((v, i) => v === new Uint8ClampedArray(b)[i]);

test("Aski's eyes come on layers of their own, two blocks, each open and shut, level, cut in the ground's colour from solid ink in its skin of characters", () => {
  const drawn = drawFigure({ width: 160, height: 160, ink, ground });
  const [left, right] = drawn.eyes.each;
  NodeAssert.ok(left && right && drawn.eyes.each.length === 2);
  NodeAssert.equal(left.y, right.y, "level");
  NodeAssert.ok(Math.abs(left.height - right.height) <= 1);
  // Upright blocks: taller than wide, the canon's 0.55.
  for (const eye of [left, right]) {
    NodeAssert.ok(Math.abs(eye.width / eye.height - 0.55) < 0.15, `${eye.width}x${eye.height}`);
    const rgba = new Uint8ClampedArray(eye.open);
    NodeAssert.deepEqual([...rgba.subarray(0, 3)], [...ground]);
    // The body under an eye is solid ink, open or shut, so it reads as cut out.
    const body = alpha(drawn.pixels);
    for (let y = eye.y; y < eye.y + eye.height; y++)
      for (let x = eye.x; x < eye.x + eye.width; x++)
        NodeAssert.equal(body[y * drawn.width + x], 255, `${x},${y}`);
    // A shut eye is a sliver of the open one.
    NodeAssert.ok(inked(eye.shut) < inked(eye.open) / 4);
  }
});

test("a mood is typed into the eyes, and the body stays as it was", () => {
  const plain = drawFigure({ width: 160, height: 160, ink, ground });
  const pleased: FigureDrawn = drawFigure({
    width: 160,
    height: 160,
    ink,
    ground,
    mood: "pleased",
  });
  NodeAssert.ok(same(plain.pixels, pleased.pixels), "the body is drawn the same");
  NodeAssert.equal(pleased.mood, "pleased");
  // The caret's arms leave most of the block's box empty.
  NodeAssert.ok(inked(pleased.eyes.each[0]!.open) < inked(plain.eyes.each[0]!.open) / 2);
});

test("an eye too small to read a character keeps its block", () => {
  // Eyes 7 device pixels tall.
  const small = drawFigure({ width: 30, height: 30, ink, ground });
  const asleep = drawFigure({ width: 30, height: 30, ink, ground, mood: "asleep" });
  NodeAssert.ok(small.eyes.each.length === 2 && small.eyes.each[0]!.height < 8);
  small.eyes.each.forEach((eye, i) =>
    NodeAssert.ok(same(eye.open, asleep.eyes.each[i]!.open), "the same block"),
  );
});

test("Aski is made of characters where they read, and solid ink where they don't", () => {
  // The share of the canvas the body inks: characters leave most of each cell empty.
  const share = (size: number): number =>
    inked(drawFigure({ width: size, height: size, ink, ground }).pixels) / (size * size);
  NodeAssert.ok(share(240) < 0.3, `characters: ${share(240)}`);
  NodeAssert.ok(share(60) > 0.45, `solid: ${share(60)}`);
  // Solid too, the eyes are cut in the ground's colour.
  const small = drawFigure({ width: 60, height: 60, ink, ground }).eyes.each[0]!;
  NodeAssert.deepEqual([...new Uint8ClampedArray(small.open).subarray(0, 3)], [...ground]);
});
