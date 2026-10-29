import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { EYES, PALETTE } from "./canon.ts";
import { makeGrid, put } from "./grid.ts";
import { GridPainter } from "./paint.ts";
import { renderGrid } from "./render.ts";
import { CELL_ASPECT, homeFit } from "./scene.ts";
import { SCENE_CARDS } from "./scenes.ts";

const STAGE = { cols: 32, rows: 10 };
const CELL = 8;

test("painting a scene frame by frame, repainting only what moved, draws what the reference draws", () => {
  for (const id of ["the-rain", "the-pond"]) {
    const card = SCENE_CARDS[id]!({ seed: 3 });
    const fit = homeFit(STAGE);
    const painter = new GridPainter(STAGE, { cell: CELL, ink: PALETTE.ink, warm: PALETTE.warm });
    const [sr, sg, sb] = PALETTE.sky;
    // Moments far apart and two close together, so both a whole new frame and a few moved cells are painted; at 4 s the koi swims, warm.
    const times = [0.4, 0.43, 4, card.beats.say!, card.still, card.end].sort((a, b) => a - b);
    for (const t of times) {
      const look = {
        cell: CELL,
        eyes: { open: card.eyes(t), fit, at: card.eyesAt?.(t, STAGE) ?? null },
      };
      const grid = card.frame(t, STAGE);
      painter.paint(grid, look.eyes);
      const want = renderGrid(grid, look).rgba;
      const got = painter.pixels;
      for (let n = 0; n < want.length; n += 4) {
        const a = got[n + 3]! / 255;
        const over = [
          sr + (got[n]! - sr) * a,
          sg + (got[n + 1]! - sg) * a,
          sb + (got[n + 2]! - sb) * a,
        ];
        for (let c = 0; c < 3; c++) {
          if (Math.abs(over[c]! - want[n + c]!) > 1.5) {
            NodeAssert.fail(
              `${id} at ${t}: pixel ${n / 4} paints ${over.map(Math.round)} where the reference has ${want.slice(n, n + 3)}`,
            );
          }
        }
      }
    }
  }
});

test("a frame that draws as the last changes no pixel", () => {
  const card = SCENE_CARDS["the-pond"]!({ seed: 3 });
  const fit = homeFit(STAGE);
  const painter = new GridPainter(STAGE, { cell: CELL, ink: PALETTE.ink, warm: PALETTE.warm });
  const eyes = { open: card.eyes(card.still), fit, at: card.eyesAt?.(card.still, STAGE) ?? null };
  NodeAssert.ok(painter.paint(card.frame(card.still, STAGE), eyes) !== undefined);
  NodeAssert.equal(painter.paint(card.frame(card.still, STAGE), eyes), undefined);
});

test("Aski's eyes are holes in whatever is under them, and ink over nothing", () => {
  const fit = homeFit(STAGE);
  const full = makeGrid(STAGE);
  for (let j = 0; j < STAGE.rows; j++) for (let i = 0; i < STAGE.cols; i++) put(full, i, j, "#", 1);
  const look = { cell: CELL, eyes: { open: 1, fit } };
  const centres = EYES.centers.map(([x, y]) => [
    Math.floor((x * fit.kx + fit.cx) * CELL),
    Math.floor(((y * fit.ky + fit.ground) * CELL) / CELL_ASPECT),
  ]);
  for (const [grid, want] of [
    [full, PALETTE.sky],
    [makeGrid(STAGE), PALETTE.ink],
  ] as const) {
    const { rgba, width } = renderGrid(grid, look);
    for (const [x, y] of centres) {
      const at = (y! * width + x!) * 4;
      NodeAssert.deepEqual([...rgba.subarray(at, at + 3)], [...want], `${x},${y}`);
    }
  }
});
