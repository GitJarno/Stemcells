import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { wornPixels } from "./looks.ts";
import looks from "./looks.json" with { type: "json" };
import look from "./cell.json" with { type: "json" };

test("every piece draws in known inks, stands whole in the band, and covers the eyes in no mood", () => {
  const [ex, ey] = look.eyes.size;
  const boxes = [look.eyes.left, look.eyes.right];
  for (const [theme, { pieces }] of Object.entries(looks.themes)) {
    for (const [name, piece] of Object.entries(pieces)) {
      const id = `${theme}/${name}`;
      NodeAssert.ok(looks.slots.includes(piece.slot), `${id}: a known slot`);
      NodeAssert.ok(
        piece.art.every((row) =>
          [...row].every((letter) => letter === "." || Object.hasOwn(looks.inks, letter)),
        ),
        `${id}: every letter is an ink`,
      );
      for (const { x, y } of wornPixels([id])) {
        // A notch's band is 32 points: a body of 20 on its foot leaves 6 rows of 2 points, one of them kept clear.
        NodeAssert.ok(
          y >= -5,
          `${id}: rises no more than five rows, so it stands whole in a notch's band`,
        );
        const inEye = boxes.some(
          ([bx = 0, by = 0]) => x >= bx && x < bx + ex! && y >= by && y < by + ey!,
        );
        NodeAssert.ok(!inEye, `${id}: nothing at ${x},${y}, inside an eye's box`);
      }
    }
  }
});
