import { describe, expect, it } from "vite-plus/test";

import { AT_DEVICE_MS, isShowTool, mayShow, SHOW_FRESH_MS, showOfInput } from "./show.ts";

describe("what Aski's show names", () => {
  it.each([
    [{ cell: "thread-1" }, { kind: "cell", environmentId: "mac", threadId: "thread-1" }],
    [{ stage: "Awake" }, { kind: "stage", stage: "awake" }],
    [{ stage: "Input" }, { kind: "stage", stage: "needs" }],
    [{ stage: "Settled" }, { kind: "stage", stage: "asleep" }],
    [{ settings: "Settings › Providers › Codex" }, { kind: "settings", place: "provider-codex" }],
    [{ settings: "Appearance" }, { kind: "settings", place: "page-appearance" }],
    [{ settings: "provider-codex" }, { kind: "settings", place: "provider-codex" }],
  ])("%o", (input, show) => {
    expect(showOfInput(input, "mac")).toEqual(show);
  });

  it.each([
    [{}],
    [{ cell: "thread-1", stage: "Input" }],
    [{ stage: "Working" }],
    [{ stage: "toString" }],
    [{ settings: "Settings › Nowhere at all" }],
    [{ cell: "" }],
    ["thread-1"],
  ])("none for %o", (input) => {
    expect(showOfInput(input, "mac")).toBeNull();
  });

  it.each([
    ["mcp__t3-code__stemcells_show", true],
    ["t3-code.stemcells_show", true],
    ["mcp__t3-code__stemcells_shows", false],
    // Another MCP server's tool of the same name.
    ["mcp__other__stemcells_show", false],
    ["other.stemcells_show", false],
    ["stemcells_show", false],
    [null, false],
  ])("%s is T3's show tool: %s", (name, is) => {
    expect(isShowTool(name)).toBe(is);
  });
});

describe("a device turns to a show only when the person is at it", () => {
  const now = 1_000_000;
  const event = { id: "item-1", at: now - 1_000, show: { kind: "stage", stage: "awake" } as const };
  const at = { askiInFront: true, visible: true, lastTouchAt: now - 5_000, now };

  it("with Aski in front, shown, touched lately and the show fresh", () => {
    expect(mayShow(event, at)).toBe(true);
  });

  it.each([
    ["Aski isn't in front", { ...at, askiInFront: false }, event],
    ["the app is hidden", { ...at, visible: false }, event],
    ["no one touched it lately", { ...at, lastTouchAt: now - AT_DEVICE_MS - 1 }, event],
    ["the show is stale", at, { ...event, at: now - SHOW_FRESH_MS - 1 }],
  ])("not when %s", (_, gate, shown) => {
    expect(mayShow(shown, gate)).toBe(false);
  });
});
