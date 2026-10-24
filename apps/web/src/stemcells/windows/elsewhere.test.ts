import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { serializeWorkspace } from "../tabs/layout";
import type { WindowElsewhere } from "./bridge";
import { askiTab, chat, tab } from "./fixtures";

/** The module as a window loads it, told of one other window at boot. */
async function load() {
  const revealed: Array<[string, string]> = [];
  let hear: (window: WindowElsewhere) => void = () => {};
  const workspace = { tabs: [tab("b1", "x", "y")], activeTabId: "b1" };
  vi.stubGlobal("window", {
    stemcellsWindows: {
      boot: {
        id: "a",
        lead: true,
        workspace: null,
        others: [{ id: "b", workspace: serializeWorkspace(workspace) }],
      },
      onElsewhere: (listener: typeof hear) => {
        hear = listener;
        return () => {};
      },
      reveal: (window: string, pane: string) => revealed.push([window, pane]),
    },
  });
  vi.resetModules();
  const elsewhere = await import("./elsewhere");
  return { elsewhere, revealed, hear: (window: WindowElsewhere) => hear(window) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chats in other windows", () => {
  it("brings forward the window showing a chat, on its pane", async () => {
    const { elsewhere, revealed } = await load();
    expect(elsewhere.revealElsewhere(chat("y"))).toBe(true);
    expect(revealed).toEqual([["b", "b1.y"]]);
    expect(elsewhere.revealElsewhere(chat("z"))).toBe(false);
  });

  it("follows what the other windows publish, and forgets one that closed", async () => {
    const { elsewhere, hear } = await load();
    hear({ id: "c", workspace: serializeWorkspace({ tabs: [tab("c1", "z")], activeTabId: "c1" }) });
    expect(elsewhere.shownElsewhere(chat("z"))).toEqual({ window: "c", pane: "c1.z" });
    hear({ id: "b", workspace: null });
    expect(elsewhere.shownElsewhere(chat("x"))).toBeNull();
  });

  it("knows when another window holds Aski's tab, and reaches Aski there", async () => {
    const { elsewhere, hear, revealed } = await load();
    expect(elsewhere.askiElsewhere()).toBeNull();
    hear({ id: "c", workspace: serializeWorkspace({ tabs: [askiTab()], activeTabId: "aski" }) });
    expect(elsewhere.askiElsewhere()).toEqual(askiTab());
    expect(elsewhere.revealElsewhere(chat("aski"))).toBe(true);
    expect(revealed).toEqual([["c", "aski-tab.aski"]]);
    hear({ id: "c", workspace: null });
    expect(elsewhere.askiElsewhere()).toBeNull();
  });
});
