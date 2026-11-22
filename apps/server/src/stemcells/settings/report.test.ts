import { describe, expect, it } from "vite-plus/test";

import { settingsReport, type MachineSettings } from "./report.ts";

const machine: MachineSettings = {
  server: (key) =>
    key === "sidebarAutoSettleOnMerge"
      ? { ast: { _tag: "Boolean" }, value: false }
      : key === "responseStreamingMode"
        ? {
            ast: {
              _tag: "Union",
              types: [
                { _tag: "Literal", literal: "turn" },
                { _tag: "Literal", literal: "paragraph" },
              ],
            },
            value: "paragraph",
          }
        : null,
  providers: [
    {
      instanceId: "antigravity",
      driver: "antigravity",
      enabled: true,
      installed: true,
      status: "ready",
      auth: { status: "authenticated", label: "Google AI Pro" },
      models: [{ name: "Neon" }, { name: "Argon" }],
    },
  ],
};

describe("what stemcells_settings answers", () => {
  it("reads each path as a card does, and says what it's set to here", () => {
    expect(
      settingsReport(
        [
          "Threads › Auto-settle merged threads",
          "Settings › Threads › Response streaming",
          "Providers › Antigravity",
          "Providers › Codex",
          "Appearance › Theme",
          "Threads",
          "System Settings › General",
        ],
        machine,
      ).split("\n"),
    ).toEqual([
      "Settings › Threads › Auto-settle merged threads: Off.",
      "Settings › Threads › Response streaming: Paragraph.",
      "Settings › Providers › Antigravity: Signed in · Google AI Pro; models: Neon, Argon.",
      "Settings › Providers › Codex: not on this machine.",
      "Settings › Appearance › Themes: kept on the person's own device, which only their app reads; a setting fence shows it live.",
      "Settings › Threads: a page; name a setting on it.",
      "System Settings › General: no place in Settings reads so.",
    ]);
  });
});
