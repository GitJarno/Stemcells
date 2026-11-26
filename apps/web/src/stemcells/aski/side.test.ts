import { describe, expect, it } from "vite-plus/test";

import { AT_DEVICE_MS, SHOW_FRESH_MS, type ShowGate } from "../../../../../stemcells/aski/show.ts";
import { ASKI_TAB_ID } from "../tabs/askiTab";
import type { Tab, Workspace } from "../tabs/layout";
import { askiTurnTarget, newShowCalls, showToAct, type ShowCall } from "./side";

const tab = (id: string): Tab => ({
  id,
  rows: [{ id: `${id}-row`, columns: [{ id: `${id}-column`, panes: [{ id, cell: null }] }] }],
  focusedPaneId: id,
});
const workspace = (active: string | null, ...ids: string[]): Workspace => ({
  tabs: ids.map(tab),
  activeTabId: active,
});

describe("Aski's turn", () => {
  it("goes to Aski from a Cell, and from no tab at all", () => {
    expect(askiTurnTarget(workspace("a", ASKI_TAB_ID, "a", "b"), "b")).toBe(ASKI_TAB_ID);
    expect(askiTurnTarget(workspace(null, ASKI_TAB_ID), null)).toBe(ASKI_TAB_ID);
  });

  it("goes back from Aski to the Cell it was turned from, not the first", () => {
    expect(askiTurnTarget(workspace(ASKI_TAB_ID, ASKI_TAB_ID, "a", "b"), "b")).toBe("b");
  });

  it("goes to the first Cell once that one has closed, and nowhere with none left", () => {
    expect(askiTurnTarget(workspace(ASKI_TAB_ID, ASKI_TAB_ID, "a", "b"), "gone")).toBe("a");
    expect(askiTurnTarget(workspace(ASKI_TAB_ID, ASKI_TAB_ID), "a")).toBeNull();
  });
});

const NOW = 1_800_000_000_000;
const AT = { environmentId: "mac", threadId: "aski" };
const gate = (over: Partial<ShowGate> = {}): ShowGate => ({
  askiInFront: true,
  visible: true,
  lastTouchAt: NOW - 1_000,
  now: NOW,
  ...over,
});
const call = (id: string, input: unknown, over: Partial<ShowCall> = {}): ShowCall => ({
  id,
  toolName: "mcp__t3-code__stemcells_show",
  status: "completed",
  input,
  completedAt: NOW - 500,
  ...over,
});
const here = (threadId: string) => threadId === "cell-1";

describe("Aski's shows", () => {
  it("lets go of what the chat holds as it loads, then takes each new call once", () => {
    const before = [call("old", { cell: "cell-1" })];
    const seeded = newShowCalls(before, null);
    expect(seeded.fresh).toEqual([]);
    const after = [...before, call("new", { cell: "cell-1" })];
    const taken = newShowCalls(after, seeded.handled);
    expect(taken.fresh.map((each) => each.id)).toEqual(["new"]);
    expect(newShowCalls(after, taken.handled).fresh).toEqual([]);
  });

  it("waits for a call to complete, and never takes a refused one or another tool", () => {
    const seeded = newShowCalls([], null).handled;
    const running = call("show", { cell: "cell-1" }, { status: "running", completedAt: null });
    const first = newShowCalls([running], seeded);
    expect(first.fresh).toEqual([]);
    expect(newShowCalls([call("show", { cell: "cell-1" })], first.handled).fresh).toHaveLength(1);
    const refused = call("refused", { cell: "cell-1" }, { status: "failed" });
    const other = call("other", { cell: "cell-1" }, { toolName: "mcp__t3-code__t3_thread_read" });
    expect(newShowCalls([refused, other], seeded).fresh).toEqual([]);
  });

  it("routes a Cell, a Settings place and a stage on Aski's machine", () => {
    expect(showToAct(call("c", { cell: "cell-1" }), AT.environmentId, gate(), here)).toEqual({
      kind: "cell",
      environmentId: "mac",
      threadId: "cell-1",
    });
    expect(
      showToAct(call("s", { settings: "page-providers" }), AT.environmentId, gate(), here),
    ).toEqual({ kind: "settings", place: "page-providers" });
    expect(showToAct(call("t", { stage: "Landed" }), AT.environmentId, gate(), here)).toEqual({
      kind: "stage",
      stage: "landed",
    });
  });

  it("opens no Cell this client doesn't have", () => {
    expect(showToAct(call("c", { cell: "elsewhere" }), AT.environmentId, gate(), here)).toBeNull();
  });

  it("turns nothing unless Aski is in front, shown, and touched lately, and the show is fresh", () => {
    const show = call("c", { cell: "cell-1" });
    for (const closed of [
      gate({ askiInFront: false }),
      gate({ visible: false }),
      gate({ lastTouchAt: NOW - AT_DEVICE_MS - 1 }),
    ]) {
      expect(showToAct(show, AT.environmentId, closed, here)).toBeNull();
    }
    const stale = call("c", { cell: "cell-1" }, { completedAt: NOW - SHOW_FRESH_MS - 1 });
    expect(showToAct(stale, AT.environmentId, gate(), here)).toBeNull();
  });
});
