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

test("a temperament blinks on its own cadence: inside its window, shut as long as it says, twice now and then", () => {
  const cadence = { windowMs: 3400, shutMs: 150, double: true };
  const shutIn = (window: number) => {
    const runs: number[] = [];
    let run = 0;
    for (let ms = 0; ms < cadence.windowMs; ms += 10) {
      const shut = isBlinking("Otter", (window * cadence.windowMs + ms) / 1000, false, cadence);
      if (shut) run += 10;
      else if (run > 0) {
        runs.push(run);
        run = 0;
      }
    }
    NodeAssert.equal(run, 0, `window ${window}: open at its end`);
    return runs;
  };
  const windows = Array.from({ length: 60 }, (_, window) => shutIn(window));
  for (const runs of windows) {
    NodeAssert.ok(runs.length === 1 || runs.length === 2);
    for (const run of runs) NodeAssert.equal(run, cadence.shutMs);
  }
  const twice = windows.filter((runs) => runs.length === 2).length;
  NodeAssert.ok(twice > 5 && twice < 40, `${twice} of 60 windows blink twice`);
});
