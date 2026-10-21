// @effect-diagnostics nodeBuiltinImport:off - reads the tokens' sheet, as the page's style does.
import * as NodeFS from "node:fs";

import { describe, expect, it, vi } from "vite-plus/test";

import { clockSeconds } from "./blink.ts";
import { BLOCKS, empty, formAt, formingOf, formingPart, HOP, inBlocks } from "./forming.ts";
import { BEAT, packLook, pastDetail, sceneOf } from "./scene.ts";

const bare = packLook([]);
const hop = sceneOf(bare, HOP)!;
const first = hop.mini[0]!;

/** How many cells of `rows` are drawn. */
const drawn = (rows: readonly string[]) =>
  rows.reduce((n, row) => n + [...row].filter((cell) => cell !== ".").length, 0);

describe("a Cell forming on its line as it starts", () => {
  it("keeps its box empty before the hand-off, then blocks, then hops, then plays its mood", () => {
    const length = hop.mini.length;
    expect(formingPart(-1, length)).toEqual({ part: "empty" });
    for (let beat = 0; beat < BLOCKS; beat++)
      expect(formingPart(beat, length)).toEqual({ part: "blocks", step: beat });
    for (let beat = BLOCKS; beat < BLOCKS + length; beat++)
      expect(formingPart(beat, length)).toEqual({ part: "hop", step: beat - BLOCKS });
    expect(formingPart(BLOCKS + length, length)).toBeUndefined();
    expect(drawn(empty(first).drawn.detail)).toBe(0);
  });

  it("fills its own outline in blocks, ░ ▒ ▓ █, in one ink, the body's", () => {
    const outline = drawn(first.drawn.detail);
    const steps = Array.from({ length: BLOCKS }, (_, step) => inBlocks(first, step));
    for (let step = 1; step < BLOCKS; step++)
      expect(drawn(steps[step]!.drawn.detail)).toBeGreaterThan(
        drawn(steps[step - 1]!.drawn.detail),
      );
    expect(drawn(steps.at(-1)!.drawn.detail)).toBe(outline);
    for (const { drawn: picture } of steps) {
      expect(new Set(picture.detail.join("").replaceAll(".", ""))).toEqual(new Set(["B"]));
      picture.detail.forEach((row, y) =>
        [...row].forEach((cell, x) => {
          if (cell !== ".") expect(first.drawn.detail[y]![x], `${x},${y}`).not.toBe(".");
        }),
      );
    }
  });

  it("hops one frame a beat and lands where it stands, inside the box", () => {
    expect(hop.fps).toBe(BEAT);
    expect(hop.mini.length).toBeGreaterThanOrEqual(3);
    for (const [i, frame] of hop.hero.entries()) expect(pastDetail(frame), `frame ${i}`).toBe(0);
  });

  it("never leaves the box empty longer than a moment past what the stream needs", () => {
    // A call names its hand-off on the page's clock; the forming keeps it on the
    // sprite clock. Both held at one moment, the hand-off reads exactly.
    const wall = Date.parse("2026-10-21T09:00:00.000Z");
    const page = 12_000;
    using _wall = vi.spyOn(Date, "now").mockReturnValue(wall);
    using _page = vi.spyOn(performance, "now").mockReturnValue(page);
    formAt("thread-far", page + 60_000);
    const forming = formingOf("thread-far")!;
    expect(forming.at - forming.asked).toBeCloseTo(3);
    formAt("thread-soon", page + 500);
    const soon = formingOf("thread-soon")!;
    expect(soon.at - clockSeconds(wall)).toBeCloseTo(0.5);
  });

  it("steps on the sprite clock's beat, the token the glyphs read", () => {
    const css = NodeFS.readFileSync(new URL("../tokens/stemcells.css", import.meta.url), "utf8");
    const step = /--sc-timing-form-step:\s*([\d.]+)ms/.exec(css)?.[1];
    expect(Number(step)).toBeCloseTo(1000 / BEAT, 2);
  });
});
