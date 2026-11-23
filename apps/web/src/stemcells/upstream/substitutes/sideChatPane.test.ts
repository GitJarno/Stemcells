/**
 * Where a Subcell, a side chat or a linked thread opens in our workspace. Upstream's own rules
 * (the setting, the modifier, what a panel can show) keep their test, `lib/sideChatPane.test.ts`.
 */
import { EnvironmentId, ThreadId, type ScopedThreadRef } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { selectThreadRightPanelState, useRightPanelStore } from "../../../rightPanelStore";
import { seatAski } from "../../tabs/askiTab";
import { cellPlaces } from "../../tabs/cellPlaces";
import { provideCellBeside, provideCellPlaces } from "../../tabs/commands";
import { EMPTY_WORKSPACE, focusPane, openTab, setCell, splitRight } from "../../tabs/layout";
import { newIds, useWorkspaceStore } from "../../tabs/store";
import { openLinkedThreadRead, openSideThread, resolveThreadOpenRoute } from "./sideChatPane";

const ref = (threadId: string): ScopedThreadRef => ({
  environmentId: EnvironmentId.make("env"),
  threadId: ThreadId.make(threadId),
});
const cell = (threadId: string) => ({ ...ref(threadId), draftId: null });

/** A tab of two Cells, `parent` and `other`, the one in `focused` focused. */
function setup(focused: "parent" | "other" = "parent") {
  useRightPanelStore.setState(useRightPanelStore.getInitialState());
  const first = newIds();
  const second = newIds();
  const one = openTab(EMPTY_WORKSPACE, first, cell("parent"));
  const two = setCell(splitRight(one, second, 1200), second.pane, cell("other"));
  const workspace = focusPane(two, focused === "parent" ? first.pane : second.pane);
  useWorkspaceStore.setState({ workspace });
  const beside: string[] = [];
  const routed: string[] = [];
  const focusedPanes: string[] = [];
  const stopBeside = provideCellBeside((opened) => beside.push(opened.threadId));
  const stopPlaces = provideCellPlaces(cellPlaces((paneId) => focusedPanes.push(paneId)));
  return {
    beside,
    routed,
    focusedPanes,
    parentPane: first.pane,
    surfaces: (threadId: string) =>
      selectThreadRightPanelState(
        useRightPanelStore.getState().byThreadKey,
        ref(threadId),
      ).surfaces.map((surface) => surface.id),
    open: (threadId: string, intent: Parameters<typeof openSideThread>[0]["intent"]) =>
      openSideThread({
        threadRef: ref(threadId),
        panelRef: ref("parent"),
        intent,
        navigate: (opened) => void routed.push(opened.threadId),
      }),
    openAski: () =>
      useWorkspaceStore.setState({ workspace: seatAski(workspace, cell("aski"), newIds(), false) }),
    [Symbol.dispose]: () => {
      stopBeside();
      stopPlaces();
    },
  };
}

describe("opening a Subcell or a side chat", () => {
  it("in the main view opens it beside its Cell, and out of that Cell's panel", () => {
    using at = setup();
    expect(at.open("child", "primary")).toBe("panel");
    expect(at.surfaces("parent")).toEqual(["thread:child"]);

    expect(at.open("child", "alternate")).toBe("main");
    expect(at.beside).toEqual(["child"]);
    expect(at.surfaces("parent")).toEqual([]);
    expect(at.routed).toEqual([]);
  });

  it("already open as a Cell brings that forward, unless the panel was asked for", () => {
    using at = setup();
    expect(at.open("other", "primary")).toBe("main");
    expect(at.beside).toEqual(["other"]);
    expect(at.surfaces("parent")).toEqual([]);

    expect(at.open("other", "panel")).toBe("panel");
    expect(at.surfaces("parent")).toEqual(["thread:other"]);
  });

  it("from a pane without focus focuses it: only the focused pane's panel shows", () => {
    using at = setup("other");
    expect(at.open("child", "primary")).toBe("panel");
    expect(at.focusedPanes).toEqual([at.parentPane]);
    expect(at.surfaces("parent")).toEqual(["thread:child"]);
  });

  it("from Aski's tab, whose chats draw no panel, opens it as a Cell", () => {
    using at = setup();
    at.openAski();
    expect(at.open("child", "primary")).toBe("main");
    expect(at.beside).toEqual(["child"]);
    expect(at.surfaces("parent")).toEqual([]);

    const pages: unknown[] = [];
    openLinkedThreadRead({
      panelRef: ref("parent"),
      target: {
        viaEnvironmentId: EnvironmentId.make("env"),
        environmentId: EnvironmentId.make("there"),
        threadId: ThreadId.make("linked"),
        label: "Studio",
        title: null,
      },
      intent: "primary",
      navigate: ((page: unknown) => void pages.push(page)) as never,
    });
    expect(pages).toHaveLength(1);
    expect(at.surfaces("parent")).toEqual([]);
  });
});

it("a side chat open as a Cell is its own route; any other shows in its parent's panel", () => {
  using at = setup();
  const sideChat = { lineage: { sideChat: true, parentThreadId: ref("parent").threadId } } as never;
  expect(resolveThreadOpenRoute(ref("other"), sideChat)).toEqual(ref("other"));
  expect(at.surfaces("parent")).toEqual([]);
  expect(resolveThreadOpenRoute(ref("child"), sideChat)).toEqual(ref("parent"));
  expect(at.surfaces("parent")).toEqual(["thread:child"]);
});
