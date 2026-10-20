import { describe, expect, it } from "vite-plus/test";

import { claudeAutoCompactThreshold, compactWindowOf, withCompactWindow } from "./claudeWindow.ts";

describe("the window Claude Cells launch with", () => {
  it("is 500k when the instance names none", () => {
    expect(compactWindowOf("")).toBe("500000");
    expect(compactWindowOf("  ")).toBe("500000");
  });

  it("is the instance's own when it names one", () => {
    expect(compactWindowOf("300000")).toBe("300000");
    expect(compactWindowOf("1000000")).toBe("1000000");
  });

  it("leaves the rest of the settings as they were", () => {
    const settings = { binaryPath: "claude", autoCompactWindow: "" };
    expect(withCompactWindow(settings)).toEqual({
      binaryPath: "claude",
      autoCompactWindow: "500000",
    });
  });
});

describe("where a Claude Cell compacts", () => {
  // What Claude Code 2.1.305's getContextUsage said for each window.
  it.each([
    { window: "300000", context: 1_000_000, at: 267_000 },
    { window: "500000", context: 1_000_000, at: 467_000 },
    { window: "750000", context: 1_000_000, at: 717_000 },
    { window: "1000000", context: 1_000_000, at: 967_000 },
  ])("compacts $window at $at", ({ window, context, at }) => {
    expect(claudeAutoCompactThreshold(window, context)).toEqual({ autoCompactThreshold: at });
  });

  it("caps the window at a smaller model's context", () => {
    expect(claudeAutoCompactThreshold("500000", 200_000)).toEqual({
      autoCompactThreshold: 167_000,
    });
    expect(claudeAutoCompactThreshold("1000000", 200_000)).toEqual({
      autoCompactThreshold: 167_000,
    });
  });

  it("takes the window alone for a model the catalog doesn't know", () => {
    expect(claudeAutoCompactThreshold("650000", null)).toEqual({ autoCompactThreshold: 617_000 });
  });

  it("says nothing when no window was handed", () => {
    expect(claudeAutoCompactThreshold("", 1_000_000)).toEqual({});
    expect(claudeAutoCompactThreshold("", null)).toEqual({});
  });
});
