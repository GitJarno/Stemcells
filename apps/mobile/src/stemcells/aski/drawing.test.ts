import { describe, expect, it } from "vite-plus/test";

// The Mac's own figure, which the phone never bundles: what the phone's drawing must match.
import { BODY_HEIGHT } from "../../../../web/src/stemcells/aski/canon.ts";
import { BODY_MID, BODY_WIDTH } from "../../../../web/src/stemcells/aski/scene.ts";
import { drawFigure } from "../../../../web/src/stemcells/aski/stage/figure.ts";
import { figureAt, skin } from "./drawing";
import { DOT } from "./kit";

describe("Aski on the phone", () => {
  it("wears the Mac's skin, dot for dot, where the Mac's sizes say it reads", () => {
    const SKIN = skin().body;
    expect(figureAt(72, 3).body).toBe(SKIN);
    expect(figureAt(72, 1).body).not.toBe(SKIN);

    // The phone's skin on a grid of half dots, where every edge of its path falls.
    const inked = new Set<string>();
    for (const [, x, y, w, h] of SKIN.matchAll(
      /M(-?[\d.]+) (-?[\d.]+)h([\d.]+)v([\d.]+)h-[\d.]+z/g,
    ))
      for (let i = 0; i < 2 * Number(w); i++)
        for (let j = 0; j < 2 * Number(h); j++)
          inked.add(`${2 * Number(x) + i},${2 * Number(y) + j}`);

    const size = 233;
    const mac = new Uint8ClampedArray(
      drawFigure({ width: size, height: size, ink: [255, 255, 255], ground: [0, 0, 0] }).pixels,
    );
    const scale = Math.min(size / BODY_WIDTH, size / BODY_HEIGHT);
    const differ: string[] = [];
    for (let py = 0; py < size; py++) {
      const y = (py + 0.5 - size) / scale;
      for (let px = 0; px < size; px++) {
        const x = (px + 0.5 - size / 2) / scale + BODY_MID.x;
        const phone = inked.has(`${Math.floor((2 * x) / DOT)},${Math.floor((2 * y) / DOT)}`);
        if (mac[(py * size + px) * 4 + 3] !== (phone ? 255 : 0)) differ.push(`${px},${py}`);
      }
    }
    expect(inked.size).toBeGreaterThan(10_000);
    expect(differ).toEqual([]);
  });
});
