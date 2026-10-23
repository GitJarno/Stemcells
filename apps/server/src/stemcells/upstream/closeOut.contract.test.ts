/**
 * The close-out reaches every Cell through the instructions upstream gives
 * every chat (`seams.md`, The close-out): one entry of its sections, which
 * Codex takes entry by entry and Claude as one appended prompt. A failure
 * here after a sync means Cells no longer say where they stand, and every
 * stop falls back to the pre-read.
 */
import {
  T3_CODE_ORCHESTRATION_INSTRUCTIONS,
  T3_CODE_ORCHESTRATION_SECTIONS,
} from "@t3tools/provider-core/server/orchestrationInstructions";
import { describe, expect, it } from "vite-plus/test";

import { readCloseOut } from "../needs/closeOut.ts";

const closeOut =
  T3_CODE_ORCHESTRATION_SECTIONS.find((section) =>
    section.startsWith("## Stemcells: say where you stand"),
  ) ?? "";

describe("the close-out every Cell is given", () => {
  it("is one of upstream's sections, so every provider delivers it", () => {
    expect(closeOut).not.toBe("");
    expect(T3_CODE_ORCHESTRATION_INSTRUCTIONS).toContain(closeOut);
  });

  it("fits a Codex entry whole", () => {
    expect(new TextEncoder().encode(closeOut).length).toBeLessThan(4_000);
  });

  it("asks for the lines the reader reads", () => {
    expect(closeOut).toContain("**Done:** what you delivered");
    expect(closeOut).toContain("**Left:** you, me or waiting:");
    expect(readCloseOut("**Done:** what you delivered").closeOut?.kind).toBe("done");
    for (const owner of ["you", "me", "waiting"] as const) {
      expect(readCloseOut(`**Left:** ${owner}: the step`).closeOut).toEqual({
        kind: "left",
        owner,
        text: "the step",
      });
    }
  });
});
