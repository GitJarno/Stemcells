// A send from the Cell in Look leaves its workbench as it was: the surface it shows stays open
// beside the chat, never floated or tucked away.
import { useSyncExternalStore } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import type { CellRef, Pane, Tab } from "../tabs/layout";
import { closeFloater, openFloaterInPanel } from "../upstream/floater";
import { threadRefOf } from "../upstream/routes";
import { render, act } from "../upstream/testRender";
import { closeCellPanel, useCellPanelOnBrowser, useCellSurfaceFloats } from "../upstream/workbench";
import { Look } from "./LookFrame";

const chat = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { lastSent: "2026-11-08T10:00:00.000Z" };
  return {
    setup: () => {
      state.lastSent = "2026-11-08T10:00:00.000Z";
    },
    read: () => state.lastSent,
    send: (at: string) => {
      state.lastSent = at;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("../upstream/chat", () => ({
  useCellLastSent: () => useSyncExternalStore(chat.subscribe, chat.read),
}));
vi.mock("../upstream/thread", () => ({ useCellTitle: () => "Heron" }));
vi.mock("../upstream/status", () => ({ useCellStatus: () => null }));
vi.mock("../tabs/CellMark", () => ({ CellMark: () => null }));

const otter: CellRef = { environmentId: "look-send", threadId: "otter", draftId: null };
const heron: CellRef = { environmentId: "look-send", threadId: "heron", draftId: null };
const otterPane: Pane = { id: "otter-pane", cell: otter };
const heronPane: Pane = { id: "heron-pane", cell: heron };
const tab: Tab = {
  id: "harbor",
  rows: [
    {
      id: "row",
      columns: [
        { id: "left", panes: [otterPane] },
        { id: "right", panes: [heronPane] },
      ],
    },
  ],
  focusedPaneId: otterPane.id,
};

function Workbench() {
  const onBrowser = useCellPanelOnBrowser(otter);
  const floats = useCellSurfaceFloats(otter);
  return <output data-on-browser={onBrowser} data-floats={floats} />;
}

/** Otter in Look, its workbench open on a browser, in a window wide enough for it. */
async function look() {
  await using stack = new AsyncDisposableStack();
  chat.setup();
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(1280, 800);
  stack.defer(() => page.viewport(viewport.width, viewport.height));
  stack.defer(() => {
    closeCellPanel(otter);
    closeFloater(threadRefOf(otter));
  });
  openFloaterInPanel(threadRefOf(otter), { kind: "browser", tabId: "site" });
  const screen = stack.use(
    await render(
      <>
        <Look tab={tab} onStage workbench={null} onFocus={() => undefined} />
        <Workbench />
      </>,
    ),
  );
  await expect.element(screen.getByRole("navigation", { name: "Other Cells" })).toBeVisible();
  return Object.assign(stack.move(), { screen });
}

describe("Look", () => {
  it("keeps the Cell's workbench open on its surface when the person sends", async () => {
    await using slate = await look();
    await act(() => chat.send("2026-11-08T10:05:00.000Z"));

    const workbench = slate.screen.container.querySelector("output");
    expect(workbench?.dataset.onBrowser).toBe("true");
    expect(workbench?.dataset.floats).toBe("false");
    await expect
      .element(slate.screen.getByRole("navigation", { name: "Other Cells" }))
      .toBeVisible();
  });
});
