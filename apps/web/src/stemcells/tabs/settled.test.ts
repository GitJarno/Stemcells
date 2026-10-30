import { describe, expect, it } from "vite-plus/test";

import {
  activateTab,
  EMPTY_WORKSPACE,
  openTab,
  setCell,
  splitRight,
  type CellRef,
  type NewIds,
  type Workspace,
} from "./layout";
import { HAND_SETTLE_MS, handSettledAtFrom, markedAt, withMark, withoutMark } from "./handSettles";
import { comeBack, leaveSlate, leavesForSettle, settlesOnClose } from "./settled";

let counter = 0;
function ids(): NewIds {
  counter += 1;
  return {
    tab: `tab-${counter}`,
    row: `row-${counter}`,
    column: `col-${counter}`,
    pane: `pane-${counter}`,
  };
}
const thread = (threadId: string): CellRef => ({ environmentId: "env", threadId, draftId: null });
const WIDE = 2_000;

function shape(workspace: Workspace) {
  return workspace.tabs.map((tab) =>
    tab.rows.flatMap((row) =>
      row.columns.flatMap((column) => column.panes.map((pane) => pane.cell?.threadId ?? "∅")),
    ),
  );
}

/** Aski's tab, then Harbor with Floof and Pip side by side, then Atlas with Otter, on stage. */
function slate() {
  let workspace = openTab(EMPTY_WORKSPACE, ids(), thread("aski"));
  workspace = openTab(workspace, ids(), thread("floof"));
  const harbor = workspace.activeTabId!;
  workspace = splitRight(workspace, ids(), WIDE);
  workspace = setCell(workspace, workspace.tabs[1]!.focusedPaneId, thread("pip"));
  workspace = openTab(workspace, ids(), thread("otter"));
  return { workspace, harbor };
}

const paneOf = (workspace: Workspace, threadId: string) =>
  workspace.tabs
    .flatMap((tab) => tab.rows.flatMap((row) => row.columns.flatMap((column) => column.panes)))
    .find((pane) => pane.cell?.threadId === threadId)!;

describe("a settled Cell leaving the slate", () => {
  it("closes its pane, and its tab with its last pane, and keeps where it stood", () => {
    const { workspace, harbor } = slate();
    const otter = leaveSlate(workspace, paneOf(workspace, "otter").id, 1);
    expect(shape(otter.workspace)).toEqual([["aski"], ["floof", "pip"]]);
    expect(otter.left).toMatchObject({ tabIndex: 2, onStage: true });
    const floof = leaveSlate(workspace, paneOf(workspace, "floof").id, 1);
    expect(shape(floof.workspace)).toEqual([["aski"], ["pip"], ["otter"]]);
    expect(floof.left).toMatchObject({ tabId: harbor, onStage: false });
  });

  it("comes back to its tab on Undo, or to a tab where its own stood", () => {
    const { workspace } = slate();
    const floof = leaveSlate(workspace, paneOf(workspace, "floof").id, 1);
    expect(shape(comeBack(floof.workspace, floof.left!, ids(), WIDE))).toEqual([
      ["aski"],
      ["pip", "floof"],
      ["otter"],
    ]);
    const onAtlas = activateTab(workspace, workspace.tabs[2]!.id);
    const otter = leaveSlate(onAtlas, paneOf(onAtlas, "otter").id, 1);
    const back = comeBack(otter.workspace, otter.left!, ids(), WIDE);
    expect(shape(back)).toEqual([["aski"], ["floof", "pip"], ["otter"]]);
    expect(back.activeTabId).toBe(back.tabs[2]!.id);
  });

  it("doesn't come back twice when it was opened again meanwhile", () => {
    const { workspace } = slate();
    const otter = leaveSlate(workspace, paneOf(workspace, "otter").id, 1);
    const reopened = openTab(otter.workspace, ids(), thread("otter"));
    expect(comeBack(reopened, otter.left!, ids(), WIDE)).toBe(reopened);
  });
});

describe("which close settles a Cell", () => {
  const landed = (cell: CellRef) => cell.threadId !== "pip";

  it("settles a landed Cell whose pane closes, and nothing still at work", () => {
    const { workspace } = slate();
    expect(settlesOnClose(workspace, paneOf(workspace, "floof").id, landed)).toEqual(
      thread("floof"),
    );
    expect(settlesOnClose(workspace, paneOf(workspace, "pip").id, landed)).toBeNull();
  });

  it("leaves a Cell another pane still shows, and an unsent draft", () => {
    const { workspace } = slate();
    const twice = openTab(workspace, ids(), thread("floof"));
    expect(settlesOnClose(twice, paneOf(workspace, "floof").id, landed)).toBeNull();
    const draft = setCell(workspace, paneOf(workspace, "otter").id, {
      ...thread("otter"),
      draftId: "draft-1",
    });
    expect(settlesOnClose(draft, paneOf(workspace, "otter").id, landed)).toBeNull();
  });
});

describe("which settle closes a pane", () => {
  const now = 1_000_000;

  it("leaves the chat open for an auto-settle, which marks nothing", () => {
    expect(leavesForSettle({ sawUnsettled: true, settled: true, markedAt: null, now })).toBe(false);
  });

  it("closes it for the person's settle while its mark is fresh", () => {
    expect(leavesForSettle({ sawUnsettled: true, settled: true, markedAt: now - 1, now })).toBe(
      true,
    );
    const stale = now - HAND_SETTLE_MS;
    expect(leavesForSettle({ sawUnsettled: true, settled: true, markedAt: stale, now })).toBe(
      false,
    );
  });

  it("closes it for the person's settle on another device, while the server's word is fresh", () => {
    const settle = (threadId: string, at: number) => ({ threadId, at: new Date(at).toISOString() });
    const settles = [settle("otter", now - HAND_SETTLE_MS), settle("otter", now - 1)];
    const heard = handSettledAtFrom(settles, "otter");
    expect(leavesForSettle({ sawUnsettled: true, settled: true, markedAt: heard, now })).toBe(true);
    const stale = handSettledAtFrom([settle("otter", now - HAND_SETTLE_MS)], "otter");
    expect(leavesForSettle({ sawUnsettled: true, settled: true, markedAt: stale, now })).toBe(
      false,
    );
    expect(handSettledAtFrom(settles, "pip")).toBeNull();
    expect(handSettledAtFrom(undefined, "otter")).toBeNull();
  });

  it("leaves open a settled Cell the pane never showed at work", () => {
    expect(leavesForSettle({ sawUnsettled: false, settled: true, markedAt: now, now })).toBe(false);
  });

  it("keeps a mark per chat, and lets old ones go", () => {
    const otter = { environmentId: "env", threadId: "otter" };
    const elsewhere = { environmentId: "other", threadId: "otter" };
    const marks = withMark(withMark({}, otter, now), elsewhere, now + HAND_SETTLE_MS);
    expect(markedAt(marks, otter)).toBeNull();
    expect(markedAt(marks, elsewhere)).toBe(now + HAND_SETTLE_MS);
    expect(markedAt(withoutMark(marks, elsewhere), elsewhere)).toBeNull();
  });
});
