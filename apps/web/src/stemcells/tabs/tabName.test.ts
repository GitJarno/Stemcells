import { describe, expect, it } from "vite-plus/test";

import { NAME_MAX_LENGTH } from "../rename/limits";
import {
  closePane,
  focusedPane,
  nameTab,
  openTab,
  panesOf,
  parseWorkspace,
  serializeWorkspace,
  setCell,
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

/** A tab of two Cells side by side, as "Say hi · 2". */
function twoCells(): Workspace {
  let workspace = openTab({ tabs: [], activeTabId: null }, ids(), thread("say-hi"));
  workspace = splitRight(workspace, ids(), 1200);
  return setCell(workspace, focusedPane(workspace)!.id, thread("other"));
}

// A tab of several Cells takes the name a person gives it; a blank name
// gives it back its focused chat's, and the name outlives a reload.
describe("a tab's own name", () => {
  it("is what was typed, trimmed, and a blank one is no name", () => {
    const workspace = twoCells();
    const tabId = workspace.tabs[0]!.id;
    const named = nameTab(workspace, tabId, "  Billing  ");
    expect(named.tabs[0]!.name).toBe("Billing");
    expect("name" in nameTab(named, tabId, "   ").tabs[0]!).toBe(false);
    expect("name" in nameTab(named, tabId, null).tabs[0]!).toBe(false);
  });

  it("is no longer than a name may be", () => {
    const workspace = twoCells();
    const tabId = workspace.tabs[0]!.id;
    const long = "x".repeat(NAME_MAX_LENGTH + 40);
    expect(nameTab(workspace, tabId, long).tabs[0]!.name).toHaveLength(NAME_MAX_LENGTH);
    const stored = serializeWorkspace(workspace) as { tabs: Array<Record<string, unknown>> };
    stored.tabs[0]!.name = long;
    expect(parseWorkspace(stored).tabs[0]!.name).toHaveLength(NAME_MAX_LENGTH);
  });

  it("survives a reload, and a stored blank name reads as none", () => {
    const workspace = twoCells();
    const tabId = workspace.tabs[0]!.id;
    const restored = parseWorkspace(serializeWorkspace(nameTab(workspace, tabId, "Billing")));
    expect(restored.tabs[0]!.name).toBe("Billing");
    const stored = serializeWorkspace(workspace) as { tabs: Array<Record<string, unknown>> };
    stored.tabs[0]!.name = " ";
    expect("name" in parseWorkspace(stored).tabs[0]!).toBe(false);
  });

  it("stays with the tab as its Cells come and go", () => {
    let workspace = twoCells();
    const tabId = workspace.tabs[0]!.id;
    workspace = nameTab(workspace, tabId, "Billing");
    workspace = closePane(workspace, panesOf(workspace.tabs[0]!)[1]!.id);
    expect(panesOf(workspace.tabs[0]!)).toHaveLength(1);
    expect(workspace.tabs[0]!.name).toBe("Billing");
  });
});
