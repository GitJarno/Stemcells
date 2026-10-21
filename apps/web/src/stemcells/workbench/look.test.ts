import { describe, expect, it } from "vite-plus/test";

import {
  activateTab,
  activeTab,
  focusedPane,
  focusPane,
  openTab,
  splitDown,
  splitRight,
  setCell,
  type CellRef,
  type Workspace,
} from "../tabs/layout";
import {
  emptyWorkbenchCell,
  endLook,
  escapeMayEndLook,
  lookPaneId,
  railPanes,
  sentSince,
  type EscapePress,
} from "./look";

const cell = (threadId: string): CellRef => ({ environmentId: "env", threadId, draftId: null });

/** A tab of three Cells: a | b over c (c stacked under b), with c focused. */
function threeCells(tabId = "t1"): Workspace {
  const id = (name: string) => ({
    tab: tabId,
    row: `${tabId}-row-${name}`,
    column: `${tabId}-col-${name}`,
    pane: `${tabId}-${name}`,
  });
  let workspace = openTab({ tabs: [], activeTabId: null }, id("a"), cell(`${tabId}-a`));
  workspace = splitRight(workspace, id("b"), 1200);
  workspace = setCell(workspace, `${tabId}-b`, cell(`${tabId}-b`));
  workspace = splitDown(workspace, id("c"));
  return setCell(workspace, `${tabId}-c`, cell(`${tabId}-c`));
}

const open = { focusedPanelOpen: true, inline: true };

describe("Look", () => {
  it("starts when the focused Cell's panel opens, and holds a stacked Cell like any other", () => {
    const tab = activeTab(threeCells());
    expect(lookPaneId(tab, { focusedPanelOpen: false, inline: true })).toBeNull();
    expect(lookPaneId(tab, open)).toBe("t1-c");
  });

  it("doesn't apply in a window too narrow for an inline panel (upstream's sheet)", () => {
    expect(lookPaneId(activeTab(threeCells()), { focusedPanelOpen: true, inline: false })).toBe(
      null,
    );
  });

  it("leaves a tab of one Cell as upstream's thread view", () => {
    const single = openTab(
      { tabs: [], activeTabId: null },
      { tab: "t", row: "r", column: "c", pane: "p" },
      cell("x"),
    );
    expect(lookPaneId(activeTab(single), open)).toBeNull();
  });

  it("puts the tab's other Cells on the rail, in reading order", () => {
    const tab = activeTab(threeCells())!;
    expect(railPanes(tab, "t1-c").map((pane) => pane.id)).toEqual(["t1-a", "t1-b"]);
    expect(railPanes(tab, "t1-a").map((pane) => pane.id)).toEqual(["t1-b", "t1-c"]);
  });

  it("is remembered per tab: each tab's focused Cell and its panel say where it was", () => {
    let workspace: Workspace = threeCells("t1");
    const other = threeCells("t2");
    workspace = { tabs: [...workspace.tabs, ...other.tabs], activeTabId: "t2" };
    workspace = focusPane(workspace, "t2-a");
    // Panels open per thread, as upstream keeps them: t1's c and nothing on t2.
    const openThreads = new Set(["t1-c"]);
    const lookOn = (current: Workspace) =>
      lookPaneId(activeTab(current), {
        focusedPanelOpen: openThreads.has(focusedPane(current)?.cell?.threadId ?? ""),
        inline: true,
      });
    expect(lookOn(workspace)).toBeNull();
    expect(lookOn(activateTab(workspace, "t1"))).toBe("t1-c");
    expect(lookOn(activateTab(activateTab(workspace, "t1"), "t2"))).toBeNull();
  });
});

describe("ending Look", () => {
  const tab = activeTab(threeCells())!;

  it("closes the Look Cell's panel and leaves focus where it is", () => {
    expect(endLook(tab, "t1-c")).toEqual({ close: [cell("t1-c")], focus: null });
  });

  it("from a mark on the rail, also focuses that Cell and closes its panel, so the slate watches", () => {
    expect(endLook(tab, "t1-c", "t1-a")).toEqual({
      close: [cell("t1-c"), cell("t1-a")],
      focus: "t1-a",
    });
  });

  it("ignores a mark for a pane that has left the tab", () => {
    expect(endLook(tab, "t1-c", "gone")).toEqual({ close: [cell("t1-c")], focus: null });
  });
});

describe("an empty workbench's ×", () => {
  const single = activeTab(
    openTab(
      { tabs: [], activeTabId: null },
      { tab: "t", row: "r", column: "c", pane: "p" },
      cell("x"),
    ),
  );
  const picking = { ...open, focusedPanelEmpty: true };

  it("closes the picker a Cell's panel opens on with nothing in it, which has no way out", () => {
    expect(emptyWorkbenchCell(single, picking)).toEqual(cell("x"));
  });

  it("stays out of a workbench that holds a surface", () => {
    expect(emptyWorkbenchCell(single, { ...picking, focusedPanelEmpty: false })).toBeNull();
  });

  it("leaves Look its own ×, which closes the panel too", () => {
    expect(emptyWorkbenchCell(activeTab(threeCells()), picking)).toBeNull();
  });

  it("leaves upstream's sheet and a closed panel alone", () => {
    expect(emptyWorkbenchCell(single, { ...picking, inline: false })).toBeNull();
    expect(emptyWorkbenchCell(single, { ...picking, focusedPanelOpen: false })).toBeNull();
  });
});

describe("a send from the Look Cell", () => {
  it("is a change in the user's last message from a value known before", () => {
    expect(sentSince("2026-10-20T10:00:00Z", "2026-10-20T10:05:00Z")).toBe(true);
    expect(sentSince("2026-10-20T10:00:00Z", "2026-10-20T10:00:00Z")).toBe(false);
  });

  it("includes a draft's first message, which makes it a thread", () => {
    expect(sentSince(null, "2026-10-20T10:05:00Z")).toBe(true);
  });

  it("isn't a chat's history arriving after Look began (a reload)", () => {
    expect(sentSince(undefined, "2026-10-20T10:00:00Z")).toBe(false);
    expect(sentSince("2026-10-20T10:00:00Z", undefined)).toBe(false);
    expect(sentSince(null, null)).toBe(false);
  });
});

describe("Esc", () => {
  const composer = { tagName: "DIV", isContentEditable: true } as unknown as EventTarget;
  const press = (overrides: Partial<EscapePress> = {}): EscapePress => ({
    key: "Escape",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    keyCode: 27,
    defaultPrevented: false,
    target: composer,
    ...overrides,
  });

  it("ends Look from the composer, though its editor marks every Esc handled", () => {
    expect(escapeMayEndLook(press(), false)).toBe(true);
    expect(escapeMayEndLook(press({ defaultPrevented: true }), false)).toBe(true);
  });

  it("leaves an Esc someone else handled outside the composer", () => {
    const body = { tagName: "BODY", isContentEditable: false } as unknown as EventTarget;
    expect(escapeMayEndLook(press({ target: body }), false)).toBe(true);
    expect(escapeMayEndLook(press({ target: body, defaultPrevented: true }), false)).toBe(false);
  });

  it("leaves open menus, dialogs, terminals and browsers their Esc", () => {
    expect(escapeMayEndLook(press(), true)).toBe(false);
  });

  it("leaves form fields, text being composed and modified keys alone", () => {
    const input = { tagName: "INPUT" } as unknown as EventTarget;
    expect(escapeMayEndLook(press({ target: input }), false)).toBe(false);
    expect(escapeMayEndLook(press({ isComposing: true }), false)).toBe(false);
    expect(escapeMayEndLook(press({ keyCode: 229 }), false)).toBe(false);
    expect(escapeMayEndLook(press({ shiftKey: true }), false)).toBe(false);
    expect(escapeMayEndLook(press({ key: "Enter" }), false)).toBe(false);
  });
});
