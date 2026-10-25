import { describe, expect, it, vi } from "vite-plus/test";

import { formingAt, formingFrom, LEAD } from "./forming";
import { BEAT, BLOCKS, clockSeconds, GLYPHS } from "./kit";

const NOW = Date.parse("2026-10-25T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("a Cell forming as its chat starts", () => {
  it("forms when first seen within a minute of its chat starting, and only once", () => {
    using _now = vi.spyOn(Date, "now").mockReturnValue(NOW);
    const from = formingFrom("fresh", ago(5_000));
    expect(from).toBeCloseTo(clockSeconds(NOW) + LEAD);
    expect(formingFrom("fresh", ago(5_000))).toBe(from);
    expect(formingFrom("old", ago(5 * 60_000))).toBeUndefined();
  });

  it("staggers Cells that start together, so their copies leave one by one", () => {
    using _now = vi.spyOn(Date, "now").mockReturnValue(NOW + 120_000);
    const first = formingFrom("one", ago(-119_000))!;
    const second = formingFrom("two", ago(-119_000))!;
    expect(second).toBeGreaterThan(first);
  });

  it("waits, condenses through the glyphs, fills in blocks, hops, then stands", () => {
    const hop = 6;
    const at = (beats: number) => formingAt(10 + beats / BEAT + 0.001, 10, hop);
    expect(at(-1)).toEqual({ part: "empty" });
    expect(GLYPHS.map((_, step) => at(step))).toEqual(
      GLYPHS.map((_, step) => ({ part: "glyphs", step })),
    );
    expect(at(GLYPHS.length)).toEqual({ part: "blocks", step: 0 });
    expect(at(GLYPHS.length + BLOCKS)).toEqual({ part: "hop", step: 0 });
    expect(at(GLYPHS.length + BLOCKS + hop)).toBeUndefined();
  });
});
