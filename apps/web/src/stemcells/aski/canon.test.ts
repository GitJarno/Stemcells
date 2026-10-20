import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { Aski } from "./aski.ts";
import { EYES, LOBES } from "./canon.ts";
import { BLOCK, BLOCK_WIDTH, eyeDistance } from "./eye.ts";
import { eyesDistance, sceneDistance } from "./sdf.ts";

test("the eye is the canon’s block cursor: upright, squared ends, one unit tall, 0.55 wide, centred on its ink", () => {
  let y0 = Infinity,
    y1 = -Infinity,
    x0 = Infinity,
    x1 = -Infinity,
    area = 0;
  const n = BLOCK.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const x = BLOCK[2 * i]!,
      y = BLOCK[2 * i + 1]!;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    area += BLOCK[2 * j]! * y - x * BLOCK[2 * j + 1]!;
  }
  NodeAssert.ok(Math.abs(y1 - y0 - 1) < 1e-9);
  NodeAssert.ok(Math.abs(x1 - x0 - BLOCK_WIDTH) < 1e-9);
  NodeAssert.ok(Math.abs((x0 + x1) / 2) < 1e-9 && Math.abs((y0 + y1) / 2) < 1e-9);
  // Squared ends, no taper: the ink fills its box.
  NodeAssert.ok(Math.abs(Math.abs(area / 2) - (x1 - x0) * (y1 - y0)) < 1e-9);
});

test("the eyes sit level, a block’s width apart, as the canon types them", () => {
  const [[lx, ly], [rx, ry]] = EYES.centers;
  NodeAssert.equal(ly, ry);
  const width = EYES.height * BLOCK_WIDTH;
  NodeAssert.ok(
    Math.abs(rx - lx - 2 * width) < width * 0.1,
    "the gap between them is about one block",
  );
});

test("facing left mirrors the eye exactly", () => {
  const e = { x: 10, y: -20, height: 70, open: 1, rot: 0, facing: 1 };
  for (const [px, py] of [
    [14, -30],
    [2, 5],
    [30, -40],
    [9, -21],
  ] as const) {
    const right = eyeDistance(px, py, e),
      left = eyeDistance(2 * e.x - px, py, { ...e, facing: -1 });
    NodeAssert.ok(Math.abs(right - left) < 1e-9, `${px},${py}`);
  }
});

test("at rest the body is the five canonical lobes, with the eyes cut into the crown", () => {
  const f = new Aski({ seed: 1, cues: [] }).frameAt(0);
  LOBES.forEach((l, i) => {
    NodeAssert.equal(f.lobes[i * 3], l.x);
    NodeAssert.equal(f.lobes[i * 3 + 1], l.y);
    NodeAssert.equal(f.lobes[i * 3 + 2], l.r);
    NodeAssert.ok(sceneDistance(f, l.x, l.y) < -l.r * 0.9);
  });
  NodeAssert.ok(sceneDistance(f, 0, -260) > 0 && sceneDistance(f, 200, -100) > 0);
  for (const [ex, ey] of EYES.centers) {
    NodeAssert.ok(eyesDistance(f, ex, ey - EYES.height * 0.3) < 0, "the head of each eye is ink");
    NodeAssert.ok(sceneDistance(f, ex, ey) < 0, "and sits inside the body");
  }
});
