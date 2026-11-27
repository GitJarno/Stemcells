// @effect-diagnostics nodeBuiltinImport:off - reads the tokens' style sheet from disk.
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import { type Bezier, cssEasing, enteredRows, LIST_MOTION } from "./listMotion";

const tokensCss = NodeFS.readFileSync(new URL("../tokens/stemcells.css", import.meta.url), "utf8");

describe("the lists' motion", () => {
  it("moves, enters and ticks on the tokens' own timings", () => {
    const token = (name: string, timing: { duration: number; easing?: Bezier }) => {
      expect(tokensCss).toContain(`--sc-motion-${name}-duration: ${timing.duration}ms;`);
      if (timing.easing)
        expect(tokensCss).toContain(`--sc-motion-${name}-easing: ${cssEasing(timing.easing)};`);
    };
    token("recede", LIST_MOTION.move);
    token("recede", LIST_MOTION.leave);
    token("fade", LIST_MOTION.enter);
    token("settle", LIST_MOTION.tick);
  });

  it("enters the rows new to a list, but none at its first reading or in a crowd", () => {
    expect(enteredRows(null, ["waffle"])).toEqual([]);
    expect(enteredRows(new Set(["waffle"]), ["toast", "waffle"])).toEqual(["toast"]);
    expect(enteredRows(new Set(["waffle"]), ["a", "b", "c", "d", "e", "waffle"])).toEqual([]);
  });
});
