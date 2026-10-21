import { describe, expect, it } from "vite-plus/test";

import { askiTab, tab } from "./fixtures";
import { takeTabsBack } from "./returned";

describe("takeTabsBack", () => {
  it("gives a window back the tab it moved to a window that couldn't open, active", () => {
    const left = { tabs: [tab("a", "1")], activeTabId: "a" };
    const ghost = { tabs: [tab("b", "2")], activeTabId: "b" };
    expect(takeTabsBack(left, ghost)).toEqual({
      tabs: [tab("a", "1"), tab("b", "2")],
      activeTabId: "b",
    });
  });

  it("keeps Aski's tab first, and doesn't take a tab twice", () => {
    const left = { tabs: [tab("a", "1")], activeTabId: "a" };
    const ghost = { tabs: [tab("a", "1"), askiTab(), tab("c", "3")], activeTabId: "a" };
    const back = takeTabsBack(left, ghost);
    expect(back.tabs.map((each) => each.id)).toEqual([askiTab().id, "a", "c"]);
    expect(back.activeTabId).toBe(askiTab().id);
  });

  it("changes nothing when every tab is here already", () => {
    const left = { tabs: [tab("a", "1")], activeTabId: "a" };
    expect(takeTabsBack(left, left)).toBe(left);
  });
});
