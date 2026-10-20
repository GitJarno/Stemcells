import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { Aski } from "./aski.ts";
import { EYES } from "./canon.ts";
import { eyeDistance, GLYPHS } from "./eye.ts";
import { MOODS, typed } from "./mood.ts";
import { eyesDistance, sceneDistance } from "./sdf.ts";

const rest = new Aski({ seed: 1, cues: [] }).frameAt(0);

test("every mood types a character Aski draws into each eye, within the eye’s height and centred across it", () => {
  for (const [mood, pair] of Object.entries(MOODS))
    for (const ch of pair) {
      const outlines = GLYPHS[ch];
      NodeAssert.ok(outlines !== undefined, `${mood}: ${ch} is drawn`);
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (const o of outlines)
        for (let i = 0; i < o.length; i += 2) {
          x0 = Math.min(x0, o[i]!);
          x1 = Math.max(x1, o[i]!);
          y0 = Math.min(y0, o[i + 1]!);
          y1 = Math.max(y1, o[i + 1]!);
        }
      NodeAssert.ok(y0 >= -0.5 - 1e-9 && y1 <= 0.5 + 1e-9, `${ch} stands no taller than the block`);
      NodeAssert.ok(Math.abs(x0 + x1) < 1e-9, `${ch} is centred across the eye`);
      NodeAssert.ok(x1 - x0 < 0.8, `${ch} leaves room between the eyes`);
    }
});

test("a mood changes the eyes and nothing else", () => {
  const pleased = typed(rest, "pleased");
  for (const [x, y] of [
    [0, -100],
    [-60, -40],
    [80, -150],
  ] as const)
    NodeAssert.equal(sceneDistance(pleased, x, y), sceneDistance(rest, x, y));
  const [ex, ey] = EYES.centers[0]!;
  // The block's foot is ink; the caret's arms stop above it.
  NodeAssert.ok(eyesDistance(rest, ex, ey + EYES.height * 0.4) < 0);
  NodeAssert.ok(eyesDistance(pleased, ex, ey + EYES.height * 0.4) > 0);
  NodeAssert.equal(typed(rest, undefined), rest);
});

test("straining’s eyes face each other, > <", () => {
  const [left, right] = typed(rest, "straining").eyes;
  const mid = (left.x + right.x) / 2;
  for (const [dx, dy] of [
    [4, -10],
    [-6, 3],
    [9, 12],
  ] as const)
    NodeAssert.ok(
      Math.abs(
        eyeDistance(left.x + dx, left.y + dy, left) -
          eyeDistance(2 * mid - left.x - dx, right.y + dy, right),
      ) < 1e-9,
    );
});

test("a typed character never reads backwards as Aski turns", () => {
  const e = { x: 10, y: -20, height: 70, open: 1, rot: 0, facing: 1, glyph: "?" };
  for (const [px, py] of [
    [0, -45],
    [24, -30],
    [10, 5],
  ] as const)
    NodeAssert.ok(
      Math.abs(eyeDistance(px, py, e) - eyeDistance(px, py, { ...e, facing: -1 })) < 1e-9,
    );
});
