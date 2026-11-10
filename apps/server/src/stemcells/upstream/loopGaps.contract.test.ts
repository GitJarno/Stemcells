// Contract: the event loop's sample counts a freeze no timer has seen yet (seams.md,
// `EventLoopMonitor.ts`; `stemcells/tasks/checkpoint-freeze.md`). A client that reconnects right
// after a freeze samples before any beat, and that sample must still report it, once.
import { expect, it } from "vite-plus/test";

import * as EventLoopMonitor from "../../observability/EventLoopMonitor.ts";

it("counts a freeze no beat has seen yet, and reports it once", () => {
  let now = 0;
  const gaps = EventLoopMonitor.makeLoopGaps(() => now);
  now = 1_000;
  gaps.beat();
  // The loop blocks for 30 s, and the reconnecting client samples before any beat.
  now = 31_000;
  expect(gaps.read()).toBe(30_000);
  now = 31_010;
  gaps.beat();
  expect(gaps.read()).toBe(10);
});
