import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { blinkStart, clockSeconds, isBlinking } from "./blink.ts";
import fixture from "./kit/fixtures/blink.json" with { type: "json" };

type Row = ["start", string, number, number] | ["shut", string, number, boolean, boolean];

test("a Cell blinks when the original's Cell of the same name blinked, and pleads on the same beat", () => {
  const misses: string[] = [];
  for (const row of fixture.rows as Row[]) {
    if (row[0] === "start") {
      const [, seed, window, start] = row;
      if (blinkStart(seed, window) !== start) misses.push(`start ${seed} #${window}`);
    } else {
      const [, seed, seconds, pleading, shut] = row;
      if (isBlinking(seed, seconds, pleading) !== shut)
        misses.push(`shut ${seed} at ${seconds}${pleading ? " pleading" : ""}`);
    }
  }
  NodeAssert.deepEqual(misses, []);
});

test("the clock counts from the reference date", () => {
  NodeAssert.equal(clockSeconds(Date.UTC(2001, 0, 1)), 0);
  NodeAssert.equal(clockSeconds(Date.UTC(2001, 0, 1, 0, 0, 4)), 4);
});
