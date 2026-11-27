// @effect-diagnostics nodeBuiltinImport:off - reads the tokens' style sheet from disk.
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import {
  type Bezier,
  catchAt,
  catchLength,
  cssEasing,
  enteredRows,
  leapAt,
  leapFrames,
  leapOf,
  LIST_MOTION,
} from "./listMotion";

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
    expect(tokensCss).toContain(`--sc-motion-catch-response: ${LIST_MOTION.catch.response};`);
    expect(tokensCss).toContain(`--sc-motion-catch-damping: ${LIST_MOTION.catch.damping};`);
  });

  it("enters the rows new to a list, but none at its first reading, in a crowd or a new view", () => {
    const before = { view: "all", keys: new Set(["waffle"]) };
    expect(enteredRows(null, "all", ["waffle"])).toEqual([]);
    expect(enteredRows(before, "all", ["toast", "waffle"])).toEqual(["toast"]);
    expect(enteredRows(before, "all", ["a", "b", "c", "d", "e", "waffle"])).toEqual([]);
    // A pick widened, or a second machine's Cells came in: the list was read again.
    expect(enteredRows(before, "mac-mini", ["toast", "waffle"])).toEqual([]);
  });
});

describe("Sleep's leap", () => {
  const cell = { x: 300, y: 200, height: 28 };
  const count = { x: 270, y: 778, height: 13 };

  it("crouches on its feet, rises slowing to its top, then falls faster into the count", () => {
    const leap = leapOf(cell, count);
    const crouched = leapAt(leap, leap.launch - 1);
    expect(crouched.scaleY).toBeLessThan(1);
    expect(crouched.y + (cell.height * crouched.scaleY) / 2).toBeCloseTo(cell.y + cell.height / 2);
    expect(leapAt(leap, leap.launch)).toMatchObject({ x: cell.x, y: cell.y });
    const { poses, step } = leapFrames(leap);
    const ys = poses.map((pose) => pose.y);
    const top = ys.indexOf(Math.min(...ys));
    expect(Math.abs(top * step - leap.apex)).toBeLessThanOrEqual(step);
    // Rising it slows; falling it speeds up: one gravity, one arc.
    const launch = Math.ceil(leap.launch / step);
    expect(ys[launch]! - ys[launch + 1]!).toBeGreaterThan(ys[top - 1]! - ys[top]!);
    expect(ys.at(-1)! - ys.at(-2)!).toBeGreaterThan(ys[top + 2]! - ys[top + 1]!);
    const landed = poses.at(-1)!;
    expect([landed.x, landed.y, landed.opacity]).toEqual([
      count.x,
      expect.closeTo(count.y),
      expect.closeTo(0),
    ]);
    expect(leap.eyes).toBeGreaterThan(leap.apex);
  });

  it("lands well inside a second, however long or short its way", () => {
    for (const from of [cell, { ...cell, y: 740 }, { ...cell, y: -400 }]) {
      const { total } = leapOf(from, count);
      expect(total).toBeGreaterThanOrEqual(LIST_MOTION.leap.crouch + LIST_MOTION.leap.air.least);
      expect(total).toBeLessThanOrEqual(LIST_MOTION.leap.crouch + LIST_MOTION.leap.air.most);
    }
  });

  it("is caught: the count gives under it, rebounds past its place, and is still by the end", () => {
    expect(catchAt(LIST_MOTION.catch.give)).toBeCloseTo(1);
    const swing = Array.from({ length: 60 }, (_, k) => catchAt(k * 10));
    expect(Math.min(...swing)).toBeLessThan(-0.05);
    expect(Math.abs(catchAt(catchLength()))).toBeLessThan(0.01);
  });
});
