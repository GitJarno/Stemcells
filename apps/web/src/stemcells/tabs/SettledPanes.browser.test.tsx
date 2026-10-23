// A pull request merging at the end of a Cell's turn closed its chat under
// its reader: upstream's auto-settle leaves the thread just as the person's
// Settle does, and the pane took either for the person's. A pane now closes
// only for a settle the person sent, whichever reaches the window first: the
// settle's mark or the settled thread.
import { useSyncExternalStore } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { act, render } from "../upstream/testRender";
import { markHandSettle, unmarkHandSettle } from "./handSettles";
import type { CellRef, Pane, Tab } from "./layout";
import { useLeavesWhenSettled } from "./SettledPanes";
import { readWorkspace, useWorkspaceStore } from "./store";

const shell = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { settled: false as boolean | null };
  return {
    setup: () => {
      state.settled = false;
    },
    read: () => state.settled,
    settle: () => {
      state.settled = true;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("../upstream/thread", () => ({
  useCellSettled: () => useSyncExternalStore(shell.subscribe, shell.read),
}));

const otter: CellRef = { environmentId: "env", threadId: "otter", draftId: null };
const pane: Pane = { id: "otter-pane", cell: otter };
const tab: Tab = {
  id: "harbor",
  rows: [{ id: "row", columns: [{ id: "column", panes: [pane] }] }],
  focusedPaneId: pane.id,
};

function OtterPane() {
  useLeavesWhenSettled(pane, true);
  return null;
}

const showing = () => readWorkspace().tabs.some((each) => each.id === tab.id);

/** Otter's pane on stage, at work, with no settle marked. */
async function slate() {
  await using stack = new AsyncDisposableStack();
  shell.setup();
  const before = useWorkspaceStore.getState().workspace;
  stack.defer(() => {
    unmarkHandSettle(otter);
    useWorkspaceStore.setState({ workspace: before });
  });
  unmarkHandSettle(otter);
  useWorkspaceStore.setState({ workspace: { tabs: [tab], activeTabId: tab.id } });
  stack.use(await render(<OtterPane />));
  return stack.move();
}

describe("a pane whose Cell is settled", () => {
  it("stays open for an auto-settle", async () => {
    await using _slate = await slate();
    await act(() => shell.settle());
    expect(showing()).toBe(true);
  });

  it("closes for the person's settle, marked before the thread turns", async () => {
    await using _slate = await slate();
    await act(() => markHandSettle(otter));
    expect(showing()).toBe(true);
    await act(() => shell.settle());
    expect(showing()).toBe(false);
  });

  it("closes for the person's settle from another window, marked after it turns", async () => {
    await using _slate = await slate();
    await act(() => shell.settle());
    expect(showing()).toBe(true);
    await act(() => markHandSettle(otter));
    expect(showing()).toBe(false);
  });
});
