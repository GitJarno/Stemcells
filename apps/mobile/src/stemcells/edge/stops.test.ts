import { describe, expect, it } from "vite-plus/test";

import { scrimStops } from "./stops";

describe("a scrim's stops", () => {
  it("ascend, from the ground whole at the edge to clear, either way up", () => {
    for (const edge of ["top", "bottom"] as const)
      for (const whole of [0, 20]) {
        const stops = scrimStops(edge, 80, whole);
        const offsets = stops.map((stop) => stop.offset);
        expect(offsets).toEqual([...new Set(offsets)].toSorted((a, b) => a - b));
        const atEdge = edge === "top" ? stops[0] : stops.at(-1);
        const far = edge === "top" ? stops.at(-1) : stops[0];
        expect(atEdge?.opacity).toBe(1);
        expect(far?.opacity).toBe(0);
      }
  });
});
