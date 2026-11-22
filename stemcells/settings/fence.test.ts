import { describe, expect, it } from "vite-plus/test";

import {
  BINDINGS,
  controlOf,
  optionLabel,
  rowStatus,
  suggestedValue,
  valueLabel,
} from "./controls.ts";
import { readSettingFence } from "./fence.ts";

describe("a setting fence, read", () => {
  it("reads a path a line, Settings or not, with a suggested value or none", () => {
    expect(
      readSettingFence(
        "Settings › Threads › Auto-settle merged threads = off\nProviders → Antigravity\n- Diffs & pull requests > Diff layout: split",
      ),
    ).toEqual([
      {
        place: {
          kind: "row",
          page: "/settings/threads",
          id: "auto-settle-merged-threads",
          anchor: "auto-settle-merged-threads",
        },
        suggested: "off",
      },
      { place: { kind: "provider", page: "/settings/providers", driver: "antigravity" } },
      {
        place: { kind: "row", page: "/settings/diffs", id: "diff-layout", anchor: "diff-layout" },
        suggested: "split",
      },
    ]);
  });

  it("keeps a line that doesn't read as its words, and is no card when none reads", () => {
    expect(readSettingFence("Threads › Nothing like this = on\nWorktrees")).toEqual([
      { words: "Threads › Nothing like this = on" },
      { place: { kind: "page", page: "/settings/worktrees" } },
    ]);
    expect(readSettingFence("const theme = 'dark';")).toBeNull();
  });
});

describe("a setting's control", () => {
  it("is a switch for a boolean and a choice for fixed words, null for anything else", () => {
    expect(controlOf({ _tag: "Boolean" })).toEqual({ kind: "switch" });
    expect(
      controlOf({
        _tag: "Union",
        types: [
          {
            _tag: "Union",
            types: [
              { _tag: "Literal", literal: "local" },
              { _tag: "Literal", literal: "worktree" },
            ],
          },
          { _tag: "Null" },
        ],
      }),
    ).toEqual({ kind: "choice", options: ["local", "worktree"] });
    expect(controlOf({ _tag: "Union", types: [{ _tag: "Number" }, { _tag: "Null" }] })).toBeNull();
  });

  it("reads a suggestion in the words a reply uses", () => {
    const choice = { kind: "choice", options: ["notifications-and-sound", "off"] } as const;
    expect(suggestedValue({ kind: "switch" }, "Off.")).toBe(false);
    expect(suggestedValue({ kind: "switch" }, "enabled")).toBe(true);
    expect(suggestedValue({ kind: "switch" }, "maybe")).toBeUndefined();
    expect(suggestedValue(choice, "Notifications and sound")).toBe("notifications-and-sound");
    expect(suggestedValue(choice, "`off`")).toBe("off");
    expect(optionLabel("hideSuccessful")).toBe("Hide successful");
    expect(valueLabel(choice, null)).toBe("Default");
    const row = BINDINGS["auto-settle-merged-threads"]!;
    expect(rowStatus({ kind: "switch" }, row, true, "off", false)).toEqual({
      kind: "suggested",
      from: "On",
      to: "Off",
      want: false,
    });
    expect(rowStatus({ kind: "switch" }, row, false, "off", false)).toEqual({
      kind: "already",
      words: "Already off.",
    });
    expect(rowStatus({ kind: "switch" }, row, false, "off", true)).toEqual({ kind: "changed" });
  });

  it("guards each setting that widens what reaches the machine or what agents do alone", () => {
    const guarded = Object.entries(BINDINGS)
      .filter(([, binding]) => binding.guarded === true)
      .map(([id]) => id)
      .sort();
    expect(guarded).toEqual([
      "agent-browser-access",
      "agent-device-access",
      "aski-takes-go-ahead",
      "aski-takes-implement",
      "aski-takes-retry",
      "default-permissions",
      "device-hub",
      "guest-links",
      "linked-environments-beta",
      "simlock-hosts",
    ]);
    // A reply may name one, but its suggestion never becomes an Apply.
    expect(rowStatus({ kind: "switch" }, BINDINGS["guest-links"]!, false, "on", false)).toEqual({
      kind: "yours",
    });
  });
});
