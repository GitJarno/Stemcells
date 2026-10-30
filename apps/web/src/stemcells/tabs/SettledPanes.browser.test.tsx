// A pane closes at once only for a settle the person sent here, whichever reaches the window
// first: the settle's mark or the settled thread.
// Upstream's auto-settle (a pull request merging at a turn's end) leaves the thread just as Settle
// does, and must not close the chat under its reader.
import { useSyncExternalStore } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { act, render } from "../upstream/testRender";
import { markHandSettle, unmarkHandSettle } from "./handSettles";
import { panesOf, type CellRef, type Pane, type Tab } from "./layout";
import { SettledComeBack, useLeavesWhenSettled } from "./SettledPanes";
import { forgetLeft, keepLeft, leaveSlate } from "./settled";
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
    unsettle: () => {
      state.settled = false;
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

const NOW = Date.parse("2026-10-26T12:00:00.000Z");
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
const otterShows = () =>
  readWorkspace()
    .tabs.flatMap(panesOf)
    .some((each) => each.cell?.threadId === otter.threadId);

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

describe("a Cell whose pane closed as it settled", () => {
  it("comes back on Undo, not while its settle is on its way", async () => {
    await using _slate = await slate();
    await using stack = new AsyncDisposableStack();
    stack.defer(() => forgetLeft(otter.threadId));
    // Its place is kept from now: the watcher forgets it 10 s on.
    stack.use(vi.spyOn(Date, "now").mockReturnValue(NOW));
    const left = leaveSlate(readWorkspace(), pane.id, NOW);
    useWorkspaceStore.setState({ workspace: left.workspace });
    keepLeft(left.left!);
    await using _back = await render(<SettledComeBack rowWidth={() => 1_200} />);
    expect(otterShows()).toBe(false);
    await act(() => shell.settle());
    expect(otterShows()).toBe(false);
    await act(() => shell.unsettle());
    expect(otterShows()).toBe(true);
  });
});
