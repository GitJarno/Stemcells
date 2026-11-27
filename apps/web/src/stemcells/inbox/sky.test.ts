import { describe, expect, it } from "vite-plus/test";

import { SKY_AT } from "../motion/sky";
import { entered, LOOP_AT_REST, read } from "./loop";
import { publishInbox, readInboxSky, skyOver } from "./sky";

const reading = (queue: string[]) => ({ view: "here", queue, open: null, onInput: true, now: 0 });

describe("Input's sky", () => {
  it("stands at dawn while Cells wait, a step lighter with each answer, and at day once none does", () => {
    const sky = (waiting: number | null, done: number | null) => ({
      waiting,
      progress: done === null ? null : { done, of: 2 },
      clears: 0,
    });
    expect(skyOver("needs", sky(null, null))).toBe(SKY_AT.dawn);
    expect(skyOver("needs", sky(2, 0))).toBe(SKY_AT.dawn);
    expect(skyOver("needs", sky(1, 1))).toBeCloseTo(SKY_AT.dawn * 0.75);
    expect(skyOver("needs", sky(0, null))).toBe(SKY_AT.day);
    expect(skyOver("asleep", sky(1, 1))).toBe(SKY_AT.night);
  });

  it("hears the all-clear in the same change as the empty queue, once", () => {
    const loop = entered(LOOP_AT_REST, reading(["pip"]), false).loop;
    publishInbox(loop, false);
    const before = readInboxSky();
    const clear = read(loop, reading([]));
    publishInbox(clear.loop, clear.allClear);
    expect(readInboxSky()).toEqual({ progress: null, waiting: 0, clears: before.clears + 1 });
    const after = readInboxSky();
    publishInbox(read(clear.loop, reading([])).loop, false);
    expect(readInboxSky()).toBe(after);
  });
});
