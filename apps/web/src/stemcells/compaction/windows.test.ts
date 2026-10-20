import { describe, expect, it } from "vite-plus/test";

import {
  compactWindowChoices,
  compactWindowIn,
  configWithCompactWindow,
  windowLabel,
} from "./windows";

describe("the Claude compaction window", () => {
  it("is 500k for an instance that names none", () => {
    expect(compactWindowIn(undefined)).toBe("500000");
    expect(compactWindowIn({ binaryPath: "claude" })).toBe("500000");
    expect(compactWindowIn({ autoCompactWindow: "" })).toBe("500000");
  });

  it("is the instance's own when it names one", () => {
    expect(compactWindowIn({ autoCompactWindow: "750000" })).toBe("750000");
    expect(compactWindowIn({ autoCompactWindow: "1000000" })).toBe("1000000");
  });

  it("offers 300k, 500k, 750k and the model's own", () => {
    expect(compactWindowChoices("500000")).toEqual([
      { value: "300000", label: "300k" },
      { value: "500000", label: "500k" },
      { value: "750000", label: "750k" },
      { value: "1000000", label: "Model's own" },
    ]);
    expect(compactWindowChoices("1000000").map((choice) => choice.value)).toEqual([
      "300000",
      "500000",
      "750000",
      "1000000",
    ]);
  });

  it("keeps a window typed before the row existed, in its place", () => {
    expect(compactWindowChoices("400000").map((choice) => choice.label)).toEqual([
      "300k",
      "400k",
      "500k",
      "750k",
      "Model's own",
    ]);
  });

  it("writes the pick into the config, and the default as no window at all", () => {
    expect(configWithCompactWindow({ binaryPath: "claude" }, "300000")).toEqual({
      binaryPath: "claude",
      autoCompactWindow: "300000",
    });
    expect(configWithCompactWindow(undefined, "1000000")).toEqual({
      autoCompactWindow: "1000000",
    });
    expect(
      configWithCompactWindow({ binaryPath: "claude", autoCompactWindow: "300000" }, "500000"),
    ).toEqual({ binaryPath: "claude" });
    expect(configWithCompactWindow({ autoCompactWindow: "300000" }, "500000")).toBeUndefined();
  });

  it("reads a window as people say it", () => {
    expect(windowLabel("300000")).toBe("300k");
    expect(windowLabel("1000000")).toBe("Model's own");
  });
});
