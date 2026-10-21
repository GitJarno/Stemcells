import { describe, expect, it } from "vite-plus/test";

import {
  addPaneOutsideAski,
  ASKI_TAB_ID,
  askiCellOf,
  closeTabUnlessAski,
  moveTabAfterAski,
  seatAski,
  showRouteBesideAski,
  splitDownOutsideAski,
  splitRightOutsideAski,
} from "./askiTab";
import {
  activeTab,
  EMPTY_WORKSPACE,
  focusedPane,
  openTab,
  panesOf,
  parseWorkspace,
  serializeWorkspace,
  setCell,
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
    column: `column-${counter}`,
    pane: `pane-${counter}`,
  };
}

const thread = (threadId: string): CellRef => ({ environmentId: "env", threadId, draftId: null });
const aski = thread("aski-thread");

function withCells(...threadIds: string[]): Workspace {
  return threadIds.reduce(
    (workspace, id) => openTab(workspace, ids(), thread(id)),
    EMPTY_WORKSPACE,
  );
}

const tabIds = (workspace: Workspace) => workspace.tabs.map((tab) => tab.id);

describe("Aski's tab", () => {
  it("comes first, and opens the app the first time", () => {
    const seated = seatAski(withCells("a", "b"), aski, ids());
    expect(seated.tabs[0]!.id).toBe(ASKI_TAB_ID);
    expect(seated.tabs).toHaveLength(3);
    expect(seated.activeTabId).toBe(ASKI_TAB_ID);
    expect(askiCellOf(seated)).toEqual(aski);
  });

  // The cold first open: the strip is empty until Aski's chat arrives. A
  // person who opened a new Cell meanwhile typed into Aski's chat once it
  // took the front, and their words went to Aski as written.
  it("never takes the front from a new Cell opened before it arrived", () => {
    const opened = EMPTY_WORKSPACE;
    const since = { openedOn: opened.activeTabId, touched: true };
    const blank = openTab(opened, ids(), null);
    const draft: CellRef = { environmentId: "env", threadId: "new", draftId: "draft-1" };
    const withDraft = setCell(blank, focusedPane(blank)!.id, draft);
    const seated = seatAski(withDraft, aski, ids(), since);
    expect(seated.tabs[0]!.id).toBe(ASKI_TAB_ID);
    expect(seated.activeTabId).toBe(withDraft.activeTabId);
    expect(focusedPane(seated)?.cell).toEqual(draft);
  });

  it("takes the front on a cold open only while the person is where it opened", () => {
    const fresh = seatAski(EMPTY_WORKSPACE, aski, ids(), { openedOn: null, touched: false });
    expect(fresh.activeTabId).toBe(ASKI_TAB_ID);
    const stored = withCells("a", "b");
    const typed = seatAski(stored, aski, ids(), { openedOn: stored.activeTabId, touched: true });
    expect(typed.activeTabId).toBe(stored.activeTabId);
    const swiped = { ...stored, activeTabId: stored.tabs[0]!.id };
    const away = seatAski(swiped, aski, ids(), { openedOn: stored.activeTabId, touched: false });
    expect(away.activeTabId).toBe(swiped.activeTabId);
  });

  it("keeps the tab the person was on once it exists", () => {
    const seated = seatAski(withCells("a"), aski, ids());
    const onCell = { ...seated, activeTabId: seated.tabs[1]!.id };
    expect(seatAski(onCell, aski, ids())).toBe(onCell);
  });

  it("follows Aski's chat when it is made again, in the same pane", () => {
    const seated = seatAski(withCells("a"), aski, ids());
    const paneId = panesOf(seated.tabs[0]!)[0]!.id;
    const reseated = seatAski(seated, thread("aski-again"), ids());
    expect(askiCellOf(reseated)).toEqual(thread("aski-again"));
    expect(panesOf(reseated.tabs[0]!)[0]!.id).toBe(paneId);
  });

  it("goes back to the front if a stored layout put it elsewhere", () => {
    const seated = seatAski(withCells("a"), aski, ids());
    const moved = { ...seated, tabs: [seated.tabs[1]!, seated.tabs[0]!] };
    expect(tabIds(seatAski(moved, aski, ids()))[0]).toBe(ASKI_TAB_ID);
  });

  it("never closes, moves or splits, and no tab moves before it", () => {
    const seated = seatAski(withCells("a", "b"), aski, ids());
    expect(closeTabUnlessAski(seated, ASKI_TAB_ID)).toBe(seated);
    expect(moveTabAfterAski(seated, ASKI_TAB_ID, 2)).toBe(seated);
    const last = seated.tabs[2]!.id;
    expect(tabIds(moveTabAfterAski(seated, last, 0))).toEqual([
      ASKI_TAB_ID,
      last,
      seated.tabs[1]!.id,
    ]);
    expect(splitRightOutsideAski(seated, ids(), 2000)).toBe(seated);
    expect(splitDownOutsideAski(seated, ids())).toBe(seated);
    const onCell = { ...seated, activeTabId: seated.tabs[1]!.id };
    expect(panesOf(activeTab(splitDownOutsideAski(onCell, ids()))!)).toHaveLength(2);
  });

  it("gives a new Cell (⌘T) a tab of its own from Aski's tab, and a pane in a Cell's tab", () => {
    const seated = seatAski(withCells("a"), aski, ids());
    const fromAski = addPaneOutsideAski(seated, ids(), 2000);
    expect(fromAski.tabs).toHaveLength(3);
    expect(panesOf(fromAski.tabs[0]!)).toHaveLength(1);
    expect(focusedPane(fromAski)?.cell).toBeNull();
    const onCell = { ...seated, activeTabId: seated.tabs[1]!.id };
    const fromCell = addPaneOutsideAski(onCell, ids(), 2000);
    expect(fromCell.tabs).toHaveLength(2);
    expect(panesOf(activeTab(fromCell)!)).toHaveLength(2);
    expect(addPaneOutsideAski(EMPTY_WORKSPACE, ids(), 2000).tabs).toHaveLength(1);
  });

  it("keeps Aski's chat when another chat is routed to from it, in a tab of its own", () => {
    const seated = seatAski(withCells("a"), aski, ids());
    const routed = showRouteBesideAski(seated, thread("new"), ids());
    expect(askiCellOf(routed)).toEqual(aski);
    expect(routed.tabs).toHaveLength(3);
    expect(focusedPane(routed)?.cell).toEqual(thread("new"));
  });

  it("hands a chat already in a pane to that pane", () => {
    const seated = seatAski(withCells("a"), aski, ids());
    const routed = showRouteBesideAski(seated, thread("a"), ids());
    expect(routed.tabs).toHaveLength(2);
    expect(activeTab(routed)?.id).toBe(seated.tabs[1]!.id);
  });

  it("is focused when Aski's chat is routed to", () => {
    const seated = seatAski(withCells("a"), aski, ids());
    const onCell = { ...seated, activeTabId: seated.tabs[1]!.id };
    expect(showRouteBesideAski(onCell, aski, ids()).activeTabId).toBe(ASKI_TAB_ID);
  });

  it("is kept with the layout", () => {
    const seated = seatAski(withCells("a"), aski, ids());
    expect(parseWorkspace(JSON.parse(JSON.stringify(serializeWorkspace(seated))))).toEqual(seated);
  });
});
