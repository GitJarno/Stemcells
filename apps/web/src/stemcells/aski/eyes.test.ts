import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { clockSeconds, isBlinking } from "../cell/blink.ts";
import { CURSOR, cursorPhase } from "./eyes.ts";

test("Aski's eyes blink like a cursor in step with a Cell that waits on the person", () => {
  const day = 1_792_540_800_000;
  for (let now = day; now < day + 5 * CURSOR; now += 37) {
    const open = cursorPhase(now) < CURSOR / 2;
    NodeAssert.equal(open, !isBlinking("Heron", clockSeconds(now), true), `at ${now}`);
  }
});
