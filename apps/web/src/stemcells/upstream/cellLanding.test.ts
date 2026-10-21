import { describe, expect, it } from "vite-plus/test";

import { landingKeyOf } from "./cellWork";

// A draft's first send made a chat that showed "Submit message" instead of
// stop for its whole first turn: its Cell read the draft's thread before the
// server listed it, and that read kept the thread's detail empty. A Cell
// reads only a thread the server lists.
describe("when a Cell reads its landing from the thread", () => {
  it("never reads a draft's thread before the server lists it", () => {
    expect(landingKeyOf({ threadId: "draft-thread" }, null)).toBeNull();
  });

  it("reads a listed thread as the Cell is drawn, as a run starts and as it lands", () => {
    const drawn = landingKeyOf({ threadId: "t" }, { latestRun: null });
    const started = landingKeyOf(
      { threadId: "t" },
      { latestRun: { runId: "r", status: "running" } },
    );
    const landed = landingKeyOf(
      { threadId: "t" },
      { latestRun: { runId: "r", status: "completed" } },
    );
    expect([drawn, started, landed].every((key) => key !== null)).toBe(true);
    expect(new Set([drawn, started, landed]).size).toBe(3);
  });
});
