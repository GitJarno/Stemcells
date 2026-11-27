import { describe, expect, it } from "vite-plus/test";

import { drawFrame, drawingOf, drawingOfSprite } from "./figure";
import {
  BODIES,
  drawSprite,
  figureOf,
  frameShown,
  hueOfBody,
  MOODS,
  paletteOf,
  poseAt,
  sceneFor,
  STILL,
  wholeView,
  wornLook,
} from "./kit";

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

describe("the modelled Cell drawn on the phone", () => {
  it("fills each pixel of its picture once, in its colour, and leaves the clear ones", () => {
    const sprite = drawSprite(
      figureOf(poseAt("writing", STILL.writing, 0)),
      wholeView(0, 32, 0, 34),
      hueOfBody("codex"),
    );
    const expected = new Map<string, string>();
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        const at = (y * sprite.width + x) * 4;
        if (sprite.pixels[at + 3] === 0) continue;
        const [red, green, blue] = sprite.pixels.subarray(at, at + 3);
        expected.set(
          `${x},${y}`,
          `#${[red!, green!, blue!].map((value) => value.toString(16).padStart(2, "0")).join("")}`,
        );
      }
    }
    const drawing = drawingOfSprite(sprite);
    expect([drawing.width, drawing.height]).toEqual([34, 32]);
    expect(expected.size).toBeGreaterThan(200);
    expect(cellsOf(drawing)).toEqual(expected);
    // Its shadow keeps its alpha; the body and its laptop are solid.
    expect(new Set(drawing.inks.map((ink) => ink.opacity)).size).toBe(2);
  });
});
