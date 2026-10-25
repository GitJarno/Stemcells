import { describe, expect, it } from "vite-plus/test";

import { drawFrame, drawingOf } from "./figure";
import { BODIES, frameShown, MOODS, paletteOf, sceneFor, wornLook } from "./kit";

/** The cells a drawing fills, each with its fill, read back from its runs. */
function cellsOf(drawing: ReturnType<typeof drawingOf>): Map<string, string> {
  const cells = new Map<string, string>();
  for (const ink of drawing.inks) {
    for (const [, x, y, width] of ink.d.matchAll(/M(-?[\d.]+) (-?[\d.]+)h([\d.]+)/g)) {
      const left = Math.round(Number(x));
      const top = Math.round(Number(y));
      for (let at = left; at < left + Math.round(Number(width)); at++) {
        expect(cells.has(`${at},${top}`), `cell ${at},${top} drawn twice`).toBe(false);
        cells.set(`${at},${top}`, ink.fill);
      }
    }
  }
  return cells;
}

describe("a Cell drawn on the phone", () => {
  it("fills each coloured cell once, in its role's colour, and leaves the clear ones", () => {
    const rows = ["..BB.E", "OOO..B", "BBbbLL"];
    const palette = paletteOf("codex");
    const expected = new Map<string, string>();
    rows.forEach((row, y) =>
      [...row].forEach((role, x) => {
        if (role !== ".") expected.set(`${x},${y}`, palette[role]!.slice(0, 7));
      }),
    );
    expect(cellsOf(drawingOf(rows, "codex"))).toEqual(expected);
  });

  it("draws every mood on every body from the web's kit, outfits and all", () => {
    const look = wornLook(["outfit:workshop/welder"]);
    for (const body of Object.keys(BODIES)) {
      for (const mood of MOODS) {
        const frame = frameShown(sceneFor(look, mood, undefined, 0), "Ferret", undefined, false);
        const drawing = drawFrame(frame, body, "black");
        expect(drawing.inks.length, `${body} ${mood}`).toBeGreaterThan(2);
        expect(cellsOf(drawing).size).toBe(frame.drawn.detail.join("").replaceAll(".", "").length);
      }
    }
  });
});
