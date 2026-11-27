import { describe, expect, it } from "vite-plus/test";

import { curated } from "../scene.ts";
import { layersOf } from "../dress.ts";
import { poseAt } from "./acts.ts";
import { figureOf } from "./body.ts";
import { drawSprite, type Sprite, standOf, tallerView, wholeView } from "./sprite.ts";
import { cellOf, roomOver, wear, wornLayers } from "./worn.ts";

const HUE = [255, 129, 84] as const;
/** The phone's picture of a Cell as it is born: the drawn Cell's own grid. */
const PHONE = wholeView(0, 32, 0, 34);

const layersIn = (look: string) => layersOf(curated(look)!.wardrobe, false);

const shows = (sprite: Sprite, x: number, y: number) =>
  sprite.pixels[(y * sprite.width + x) * 4 + 3] !== 0;
const topOf = (sprite: Sprite) => {
  for (let y = 0; y < sprite.height; y++)
    for (let x = 0; x < sprite.width; x++) if (shows(sprite, x, y)) return y;
  return sprite.height;
};

function pictured(look: string, act: "rest" | "landed", view = PHONE) {
  const figure = figureOf(poseAt(act, act === "rest" ? 1000 : 560, 0));
  const bare = drawSprite(figure, view, HUE);
  const worn = wear(drawSprite(figure, view, HUE), figure, view, layersIn(look), "claude");
  return { figure, bare, worn };
}

describe("the drawn wardrobe on the modelled Cell", () => {
  it("keeps a piece's pixels whole on the phone, and doubles them at the Mac's size", () => {
    const half = (rows: number) =>
      standOf(figureOf(poseAt("rest", 1000, 0)), wholeView(0, rows)).half;
    expect(cellOf(half(32))).toBe(1);
    expect(cellOf(half(64))).toBe(2);
  });

  it("puts a hat on the head: over the crown, and across its middle", () => {
    const { figure, bare, worn } = pictured("wizard", "rest");
    const crown = standOf(figure, PHONE).crown;
    expect(topOf(worn)).toBeLessThan(topOf(bare) - 4);
    const columns: number[] = [];
    // The hat is what the picture gained: its brim lies over the head's top rows.
    for (let at = 0; at < worn.pixels.length; at += 4)
      if (worn.pixels.slice(at, at + 4).join() !== bare.pixels.slice(at, at + 4).join())
        columns.push((at / 4) % worn.width);
    expect(Math.min(...columns)).toBeLessThan(crown[0] - 4);
    expect(Math.max(...columns)).toBeGreaterThan(crown[0] + 4);
  });

  it("leaves a bare Cell's picture as it was", () => {
    const figure = figureOf(poseAt("rest", 1000, 0));
    const bare = drawSprite(figure, PHONE, HUE);
    expect(wear(drawSprite(figure, PHONE, HUE), figure, PHONE, wornLayers([]), "claude")).toEqual(
      bare,
    );
    expect(roomOver(figure, PHONE, [])).toBe(0);
  });

  it("draws a piece on the back only past the body", () => {
    const { bare, worn } = pictured("angel", "rest");
    const wings = layersIn("angel").filter((layer) => layer.z < 0);
    expect(wings.length).toBeGreaterThan(0);
    const figure = figureOf(poseAt("rest", 1000, 0));
    const winged = wear(drawSprite(figure, PHONE, HUE), figure, PHONE, wings, "claude");
    let past = 0;
    for (let at = 0; at < bare.pixels.length; at += 4) {
      if (bare.pixels[at + 3] !== 0)
        expect(winged.pixels.slice(at, at + 4)).toEqual(bare.pixels.slice(at, at + 4));
      else if (winged.pixels[at + 3] !== 0) past++;
    }
    expect(past).toBeGreaterThan(10);
    expect(worn.pixels).not.toEqual(bare.pixels);
  });

  it("gives tall headwear room, so a hop cuts none of it off", () => {
    const layers = layersIn("wizard");
    const over = roomOver(figureOf(poseAt("rest", 1000, 0)), PHONE, layers);
    expect(over).toBeGreaterThan(0);
    const view = tallerView(PHONE, over);
    const { worn } = pictured("wizard", "landed", view);
    expect(topOf(worn)).toBeGreaterThan(0);
    // The Cell stands where it stood: only rows over it were added.
    const rest = figureOf(poseAt("rest", 1000, 0));
    expect(standOf(rest, view).crown[1] - standOf(rest, PHONE).crown[1]).toBeCloseTo(over);
  });
});
