import { describe, expect, it } from "vite-plus/test";

import {
  activeTab,
  closePane,
  closeTab,
  EMPTY_WORKSPACE,
  focusedPane,
  focusPane,
  MIN_COLUMN_WIDTH,
  moveTab,
  openTab,
  panesOf,
  parseWorkspace,
  serializeWorkspace,
  setCell,
  showRoute,
  splitDown,
  splitRight,
  type CellRef,
  type NewIds,
  type Workspace,
} from "./layout";

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
const draft = (threadId: string, draftId = `draft-${threadId}`): CellRef => ({
  environmentId: "env",
  threadId,
  draftId,
});

/** Each tab's panes as rows of columns of thread ids, for readable assertions. */
function shape(workspace: Workspace) {
  return workspace.tabs.map((tab) =>
    tab.rows.map((row) =>
      row.columns.map((column) => column.panes.map((pane) => pane.cell?.threadId ?? "∅")),
    ),
  );
}

/** Opens a pane next to or under the focused one and fills it, as a new Cell does. */
function fill(workspace: Workspace, cell: CellRef): Workspace {
  return setCell(workspace, focusedPane(workspace)!.id, cell);
}

describe("tabs", () => {
  it("a route with no tabs opens one showing that chat", () => {
    const workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    expect(shape(workspace)).toEqual([[[["a"]]]]);
    expect(focusedPane(workspace)?.cell).toEqual(thread("a"));
  });

  it("a new tab is appended and becomes active", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = openTab(workspace, ids(), null);
    expect(workspace.tabs).toHaveLength(2);
    expect(activeTab(workspace)).toBe(workspace.tabs[1]);
  });

  it("closing the active tab activates its right neighbour, else its left", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = fill(openTab(workspace, ids(), null), thread("b"));
    workspace = fill(openTab(workspace, ids(), null), thread("c"));
    const [first, second, third] = workspace.tabs;
    workspace = closeTab(activeTabIs(workspace, second!.id), second!.id);
    expect(workspace.activeTabId).toBe(third!.id);
    workspace = closeTab(workspace, third!.id);
    expect(workspace.activeTabId).toBe(first!.id);
  });

  it("moving a tab keeps every tab and puts it at the new index", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = fill(openTab(workspace, ids(), null), thread("b"));
    workspace = fill(openTab(workspace, ids(), null), thread("c"));
    const ids0 = workspace.tabs.map((tab) => tab.id);
    workspace = moveTab(workspace, ids0[0]!, 2);
    expect(workspace.tabs.map((tab) => tab.id)).toEqual([ids0[1], ids0[2], ids0[0]]);
  });
});

function activeTabIs(workspace: Workspace, tabId: string): Workspace {
  return { ...workspace, activeTabId: tabId };
}

describe("panes", () => {
  it("split right adds a column beside the focused pane and focuses it", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = splitRight(workspace, ids(), 1200);
    expect(shape(workspace)).toEqual([[[["a"], ["∅"]]]]);
    expect(focusedPane(workspace)?.cell).toBeNull();
  });

  it("a new column goes right after the focused one, not at the end", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = fill(splitRight(workspace, ids(), 1200), thread("b"));
    workspace = focusPane(workspace, panesOf(workspace.tabs[0]!)[0]!.id);
    workspace = fill(splitRight(workspace, ids(), 1200), thread("c"));
    expect(shape(workspace)).toEqual([[[["a"], ["c"], ["b"]]]]);
  });

  it("a column that would be narrower than the minimum starts a new row", () => {
    const width = MIN_COLUMN_WIDTH * 2;
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = fill(splitRight(workspace, ids(), width), thread("b"));
    workspace = fill(splitRight(workspace, ids(), width), thread("c"));
    expect(shape(workspace)).toEqual([[[["a"], ["b"]], [["c"]]]]);
  });

  it("split down stacks a pane under the focused one in its column", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = fill(splitRight(workspace, ids(), 1200), thread("b"));
    workspace = fill(splitDown(workspace, ids()), thread("c"));
    expect(shape(workspace)).toEqual([[[["a"], ["b", "c"]]]]);
  });

  it("closing a pane focuses the one before it, and an emptied column goes", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = fill(splitRight(workspace, ids(), 1200), thread("b"));
    workspace = fill(splitDown(workspace, ids()), thread("c"));
    workspace = closePane(workspace, focusedPane(workspace)!.id);
    expect(shape(workspace)).toEqual([[[["a"], ["b"]]]]);
    expect(focusedPane(workspace)?.cell?.threadId).toBe("b");
    workspace = closePane(workspace, focusedPane(workspace)!.id);
    expect(shape(workspace)).toEqual([[[["a"]]]]);
    expect(focusedPane(workspace)?.cell?.threadId).toBe("a");
  });

  it("closing the first pane focuses the next one", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = fill(splitRight(workspace, ids(), 1200), thread("b"));
    workspace = closePane(workspace, panesOf(workspace.tabs[0]!)[0]!.id);
    expect(focusedPane(workspace)?.cell?.threadId).toBe("b");
  });

  it("the last pane closes its tab", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = fill(openTab(workspace, ids(), null), thread("b"));
    workspace = closePane(workspace, focusedPane(workspace)!.id);
    expect(shape(workspace)).toEqual([[[["a"]]]]);
    expect(focusedPane(workspace)?.cell?.threadId).toBe("a");
  });

  it("focusing a pane in another tab activates that tab", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    const paneA = focusedPane(workspace)!.id;
    workspace = fill(openTab(workspace, ids(), null), thread("b"));
    workspace = focusPane(workspace, paneA);
    expect(workspace.activeTabId).toBe(workspace.tabs[0]!.id);
    expect(focusedPane(workspace)?.id).toBe(paneA);
  });
});

describe("routes", () => {
  it("going to a chat shows it in the focused pane", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = fill(splitRight(workspace, ids(), 1200), thread("b"));
    workspace = showRoute(workspace, thread("c"), ids());
    expect(shape(workspace)).toEqual([[[["a"], ["c"]]]]);
  });

  it("going to a chat another pane shows focuses that pane instead of showing it twice", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    const paneA = focusedPane(workspace)!.id;
    workspace = fill(openTab(workspace, ids(), null), thread("b"));
    workspace = showRoute(workspace, thread("a"), ids());
    expect(shape(workspace)).toEqual([[[["a"]]], [[["b"]]]]);
    expect(focusedPane(workspace)?.id).toBe(paneA);
  });

  it("a sent draft arrives as its thread and stays in its pane", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, draft("a"), ids());
    workspace = showRoute(workspace, thread("a"), ids());
    expect(shape(workspace)).toEqual([[[["a"]]]]);
    expect(focusedPane(workspace)?.cell).toEqual(thread("a"));
  });

  it("a draft sent in a pane the user left updates that pane without taking focus", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, draft("a"), ids());
    const paneA = focusedPane(workspace)!.id;
    workspace = fill(splitRight(workspace, ids(), 1200), thread("b"));
    const paneB = focusedPane(workspace)!.id;
    workspace = showRoute(workspace, thread("a"), ids());
    expect(focusedPane(workspace)?.id).toBe(paneB);
    expect(panesOf(workspace.tabs[0]!).find((pane) => pane.id === paneA)?.cell).toEqual(
      thread("a"),
    );
  });

  it("an empty pane whose new Cell landed in another pane is dropped", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = openTab(workspace, ids(), null);
    workspace = openTab(workspace, ids(), null);
    // The first tab's new Cell arrives while the second empty tab is focused.
    workspace = showRoute(workspace, draft("b"), ids());
    expect(shape(workspace)).toEqual([[[["a"]]], [[["b"]]]]);
  });

  it("an empty pane left behind when focus moves away is dropped", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = splitRight(workspace, ids(), 1200);
    // The new Cell turned out to be a chat the first pane already shows.
    workspace = showRoute(workspace, thread("a"), ids());
    expect(shape(workspace)).toEqual([[[["a"]]]]);
  });
});

describe("persistence", () => {
  it("tabs, panes, order and focus survive a round trip through storage", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = fill(splitDown(workspace, ids()), draft("b"));
    workspace = fill(openTab(workspace, ids(), null), thread("c"));
    workspace = moveTab(workspace, workspace.tabs[1]!.id, 0);
    const restored = parseWorkspace(JSON.parse(JSON.stringify(serializeWorkspace(workspace))));
    expect(restored).toEqual(workspace);
  });

  it("an empty pane is not stored, and focus moves to a stored pane", () => {
    let workspace = showRoute(EMPTY_WORKSPACE, thread("a"), ids());
    workspace = splitRight(workspace, ids(), 1200);
    const restored = parseWorkspace(serializeWorkspace(workspace));
    expect(shape(restored)).toEqual([[[["a"]]]]);
    expect(focusedPane(restored)?.cell).toEqual(thread("a"));
  });

  it("anything unreadable restores as an empty workspace", () => {
    expect(parseWorkspace(null)).toEqual(EMPTY_WORKSPACE);
    expect(parseWorkspace({ version: 99, tabs: [] })).toEqual(EMPTY_WORKSPACE);
    expect(parseWorkspace({ version: 1, tabs: [{ id: "t", rows: "nope" }] })).toEqual(
      EMPTY_WORKSPACE,
    );
  });
});
