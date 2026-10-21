import { describe, expect, it } from "vite-plus/test";

import { OpenCodeTextGenerationSessionRequestError } from "./textGeneration.ts";

// Stemcells (stemcells/seams.md): Aski's planner runs `runLean`, and a lean
// call that fails on OpenCode says so in its own words, not as a defect.
describe("OpenCode's text generation errors", () => {
  it("name a lean call, and only the operations there are", () => {
    const cause = new Error("down");
    const lean = new OpenCodeTextGenerationSessionRequestError({
      operation: "runLean",
      cwd: "/tmp/plan",
      cause,
    });
    expect(lean.message).toBe("OpenCode session creation request failed for runLean in /tmp/plan.");
    expect(
      () =>
        new OpenCodeTextGenerationSessionRequestError({
          operation: "planEverything" as never,
          cwd: "/tmp/plan",
          cause,
        }),
    ).toThrow();
  });
});
