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
    token("leave", LIST_MOTION.leave);
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
  // A row's Cell, and Asleep's segment above it: the phone's pill stands on top.
  const cell = { x: 40, y: 300, height: 30 };
  const count = { x: 320, y: 142, height: 18 };

  it("crouches on its feet, rises slowing to its top, then falls faster onto the count", () => {
    const leap = leapOf(cell, count);
    const crouched = leapAt(leap, leap.launch - 1);
    expect(crouched.scaleY).toBeLessThan(1);
    expect(crouched.y + (cell.height * crouched.scaleY) / 2).toBeCloseTo(cell.y + cell.height / 2);
    expect(leapAt(leap, leap.launch)).toMatchObject({ x: cell.x, y: cell.y });
    const { poses, step } = leapFrames(leap);
    const air = poses.slice(0, Math.floor(leap.contact / step));
    const ys = air.map((pose) => pose.y);
    const top = ys.indexOf(Math.min(...ys));
    expect(Math.abs(top * step - leap.apex)).toBeLessThanOrEqual(step);
    // Rising it slows; falling it speeds up: one gravity, one arc.
    const launch = Math.ceil(leap.launch / step);
    expect(ys[launch]! - ys[launch + 1]!).toBeGreaterThan(ys[top - 1]! - ys[top]!);
    expect(ys.at(-1)! - ys.at(-2)!).toBeGreaterThan(ys[top + 2]! - ys[top + 1]!);
    expect(leap.eyes).toBeGreaterThan(leap.apex);
  });

  it("is over the count as it rises past it, so it never crosses the stages beside it", () => {
    for (const thrown of [0, 2400]) {
      for (const from of [cell, { ...cell, y: 700 }, { ...cell, x: 200 }]) {
        const leap = leapOf(from, count, thrown);
        const { poses } = leapFrames(leap, 2);
        const passing = poses.find((pose) => pose.y <= count.y + count.height / 2)!;
        const way = count.x - from.x;
        expect((passing.x - from.x) / way).toBeGreaterThanOrEqual(LIST_MOTION.leap.overBy - 0.02);
        // Its top stands just over the count, not up in the status bar.
        expect(count.y - leapAt(leap, leap.apex).y).toBeLessThanOrEqual(
          LIST_MOTION.leap.riseMost + count.height,
        );
      }
    }
  });

  it("thrown by a swipe, it springs off at once, as fast across as the row it left", () => {
    const row = 2400;
    const leap = leapOf(cell, count, row);
    expect(leap.launch).toBe(0);
    const step = 4;
    const speed = ((leapAt(leap, step).x - leapAt(leap, 0).x) / step) * 1000;
    expect(speed).toBeGreaterThan(row * LIST_MOTION.leap.carries * 0.85);
    // Not a hitch: no squash at the release, a stretch into the leap instead.
    expect(leapAt(leap, 0).scaleY).toBeCloseTo(1);
    expect(leapAt(leap, LIST_MOTION.leap.push).scaleY).toBeGreaterThan(1);
    // A slow release is a jump from rest.
    expect(leapOf(cell, count, 120).launch).toBe(LIST_MOTION.leap.crouch);
  });

  it("touches down whole on the count, squashes as it lands, then sinks into it", () => {
    const leap = leapOf(cell, count, 2400);
    const touching = leapAt(leap, leap.contact);
    expect(touching).toMatchObject({ x: count.x, opacity: 1 });
    expect(touching.y).toBeCloseTo(count.y - count.height / 2);
    const squashed = leapAt(leap, leap.contact + LIST_MOTION.leap.sink * 0.2);
    expect(squashed.scaleX).toBeGreaterThan(squashed.scaleY);
    const gone = leapAt(leap, leap.total);
    expect(gone.opacity).toBeCloseTo(0);
    expect(gone.y).toBeCloseTo(count.y);
    expect(gone.rotate).toBeCloseTo(0);
    // Caught on a bar's rim, it sinks from there through into the count.
    const rim = count.y - 16;
    const onRim = leapOf(cell, { ...count, surface: rim }, 2400);
    expect(leapAt(onRim, onRim.contact).y).toBeCloseTo(rim - count.height / 2);
    expect(leapAt(onRim, onRim.total).y).toBeCloseTo(count.y);
  });

  it("lands well inside a second, however long or short its way", () => {
    for (const from of [cell, { ...cell, y: 740 }, { ...cell, y: -400 }]) {
      for (const thrown of [0, 2400]) {
        const { contact, total } = leapOf(from, count, thrown);
        expect(contact).toBeGreaterThanOrEqual(LIST_MOTION.leap.air.least);
        expect(contact).toBeLessThanOrEqual(LIST_MOTION.leap.crouch + LIST_MOTION.leap.air.most);
        expect(total - contact).toBe(LIST_MOTION.leap.sink);
      }
    }
  });

  it("is caught: the count gives under it, rebounds past its place, and is still by the end", () => {
    expect(catchAt(LIST_MOTION.catch.give)).toBeCloseTo(1);
    const swing = Array.from({ length: 60 }, (_, k) => catchAt(k * 10));
    expect(Math.min(...swing)).toBeLessThan(-0.05);
    expect(Math.abs(catchAt(catchLength()))).toBeLessThan(0.01);
  });
});
