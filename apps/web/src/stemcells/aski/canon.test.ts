import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { Aski } from "./aski.ts";
import { EYES, LOBES } from "./canon.ts";
import { APOSTROPHE, eyeDistance } from "./eye.ts";
import { eyesDistance, sceneDistance } from "./sdf.ts";

test("the apostrophe is one closed outline, one unit tall, centred on its ink", () => {
  let y0 = Infinity,
    y1 = -Infinity,
    x0 = Infinity,
    x1 = -Infinity,
    area = 0;
  const n = APOSTROPHE.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const x = APOSTROPHE[2 * i]!,
      y = APOSTROPHE[2 * i + 1]!;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    area += APOSTROPHE[2 * j]! * y - x * APOSTROPHE[2 * j + 1]!;
  }
  NodeAssert.ok(Math.abs(y1 - y0 - 1) < 1e-9);
  NodeAssert.ok(Math.abs((x0 + x1) / 2) < 1e-9 && Math.abs((y0 + y1) / 2) < 1e-9);
  // Heavy enough to read as an eye: a good share of its box is ink.
  NodeAssert.ok(Math.abs(area / 2) / ((x1 - x0) * (y1 - y0)) > 0.45);
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
