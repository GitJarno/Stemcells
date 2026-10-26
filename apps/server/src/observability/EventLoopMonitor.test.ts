import { assert, describe, it } from "@effect/vitest";

import * as EventLoopMonitor from "./EventLoopMonitor.ts";

const ms = (value: number) => value * 1e6;

// Node reports a stall of S as a gap of up to S + 1 s, the histogram resolution.
const stalled: EventLoopMonitor.EventLoopReadings = {
  delayMaxNs: ms(5_950),
  activeMs: 6_200,
  utilization: 0.176,
  usage: {
    userCPUTime: 310_400,
    systemCPUTime: 95_600,
    majorPageFault: 8_412,
    minorPageFault: 20_031,
    involuntaryContextSwitches: 57,
  },
  rssBytes: 1536 * 1024 * 1024,
  heapUsedBytes: 512 * 1024 * 1024,
  elapsedMs: 30_000,
  loadAverage: 219.43,
  cpuCount: 18,
};

describe("EventLoopMonitor", () => {
  it("ignores delay the loop spent idle, such as a system sleep", () => {
    const asleep: EventLoopMonitor.EventLoopReadings = {
      ...stalled,
      delayMaxNs: ms(600_000),
      activeMs: 900,
    };
    assert.isUndefined(EventLoopMonitor.stallMs(asleep));
    assert.strictEqual(EventLoopMonitor.stallMs({ ...asleep, activeMs: 600_000 }), 599_000);
  });

  it("counts a freeze no timer has seen yet, as when a client reconnects right after it", () => {
    let now = 0;
    const gaps = EventLoopMonitor.makeLoopGaps(() => now);
    now = 1_000;
    gaps.beat();
    // The loop blocks for 30 s, and the reconnecting client samples before any beat.
    now = 31_000;
    assert.strictEqual(gaps.read(), 30_000);
    // The beat that runs next does not report the same freeze again.
    now = 31_010;
    gaps.beat();
    assert.strictEqual(gaps.read(), 10);
  });
});
