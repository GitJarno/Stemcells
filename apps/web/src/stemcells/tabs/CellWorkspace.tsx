import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";

import { ChatPaneView, useCellPresence, useOpenNewCell } from "../upstream/chat";
import { dropLeftDraft, fileDraftUnderPane, useCellForRoute } from "../upstream/drafts";
import { useIsIndexRoute, useNavigateToCell, type ThreadRouteTarget } from "../upstream/routes";
import { cn, Empty, EmptyDescription, EmptyHeader, EmptyTitle, SidebarInset } from "../upstream/ui";
import {
  activateTab,
  activeTab,
  closePane,
  closeTab,
  findPane,
  focusedPane,
  focusPane,
  moveTab,
  openTab,
  panesOf,
  paneShowing,
  sameChat,
  setCell,
  showRoute,
  splitDown,
  splitRight,
  type CellRef,
  type Pane,
  type Workspace,
} from "./layout";
import { newIds, readWorkspace, updateWorkspace, useWorkspaceStore } from "./store";
import { TabStrip } from "./TabStrip";
import { useWorkspaceKeys } from "./useWorkspaceKeys";

function routeKey(cell: CellRef): string {
  return `${cell.environmentId}/${cell.threadId}/${cell.draftId ?? ""}`;
}

function cellsOf(workspace: Workspace): CellRef[] {
  return workspace.tabs.flatMap((tab) => panesOf(tab).flatMap((pane) => pane.cell ?? []));
}

/**
 * The chat area as tabs of panes. The URL names the chat the focused pane
 * shows: going to a chat (sidebar, new thread, a link) fills the focused
 * pane, or focuses the pane already showing it; focusing a pane routes to
 * its chat. `target` is the route's chat; `fallback` is upstream's page for
 * routes without one.
 */
export function CellWorkspace(props: { target: ThreadRouteTarget | null; fallback: ReactNode }) {
  const workspace = useWorkspaceStore((store) => store.workspace);
  const takenRoute = useWorkspaceStore((store) => store.takenRoute);
  const routeCell = useCellForRoute(props.target);
  const isIndexRoute = useIsIndexRoute();
  const navigateToCell = useNavigateToCell();
  const openNewCell = useOpenNewCell();
  const gridRef = useRef<HTMLDivElement>(null);
  const tab = activeTab(workspace);
  const focused = focusedPane(workspace);
  const focusedPresence = useCellPresence(focused?.cell ?? null);

  const routeToFocused = () => {
    const cell = focusedPane(readWorkspace())?.cell;
    if (cell) navigateToCell(cell, { replace: true });
  };

  const onRoute = useEffectEvent((cell: CellRef) => {
    updateWorkspace((current) => showRoute(current, cell, newIds()));
    useWorkspaceStore.setState({ takenRoute: routeKey(cell) });
    const holder = paneShowing(readWorkspace(), cell);
    if (holder && cell.draftId !== null) fileDraftUnderPane(cell.draftId, holder.pane.id);
    // A draft sent in a pane the user has since left routes to its thread;
    // the route goes back to the pane the user is in.
    const nowFocused = focusedPane(readWorkspace())?.cell;
    if (nowFocused && !sameChat(nowFocused, cell)) routeToFocused();
  });
  const routeEnvironmentId = routeCell?.environmentId ?? null;
  const routeThreadId = routeCell?.threadId ?? null;
  const routeDraftId = routeCell?.draftId ?? null;
  useEffect(() => {
    if (routeEnvironmentId === null || routeThreadId === null) return;
    onRoute({ environmentId: routeEnvironmentId, threadId: routeThreadId, draftId: routeDraftId });
  }, [routeEnvironmentId, routeThreadId, routeDraftId]);

  // On the index route, go back to the focused Cell if it still exists.
  // Otherwise upstream's index starts a draft, which the focused pane takes.
  const returnToFocused =
    props.target === null && isIndexRoute && focusedPresence.liveness === "alive";
  const goToFocused = useEffectEvent(routeToFocused);
  useEffect(() => {
    if (returnToFocused) goToFocused();
  }, [returnToFocused]);

  // A draft that left every pane goes too, unless something was written in it.
  useEffect(
    () =>
      useWorkspaceStore.subscribe((state, previous) => {
        const kept = cellsOf(state.workspace);
        for (const cell of cellsOf(previous.workspace)) {
          if (!kept.some((other) => sameChat(other, cell))) dropLeftDraft(cell);
        }
      }),
    [],
  );

  const focusPaneAndRoute = (paneId: string) => {
    updateWorkspace((current) => focusPane(current, paneId));
    routeToFocused();
  };

  const activateTabAndRoute = (tabId: string) => {
    updateWorkspace((current) => activateTab(current, tabId));
    routeToFocused();
  };

  const closeTabAndRoute = (tabId: string) => {
    const before = readWorkspace();
    updateWorkspace((current) => closeTab(current, tabId));
    if (activeTab(readWorkspace())?.id !== activeTab(before)?.id) routeToFocused();
  };

  /** Adds an empty pane (or tab) and opens a new Cell into it through upstream's new thread. */
  const openCellNow = async (change: (current: Workspace) => Workspace) => {
    const previousPaneId = focusedPane(readWorkspace())?.id ?? null;
    updateWorkspace(change);
    const paneId = focusedPane(readWorkspace())?.id;
    if (!paneId) return;
    const cell = await openNewCell().catch(() => null);
    const current = readWorkspace();
    const stillEmpty = findPane(current, (pane) => pane.id === paneId)?.pane.cell === null;
    if (!cell) {
      // Nothing opened (no project, or the user went elsewhere): the empty pane goes.
      if (stillEmpty) {
        updateWorkspace((latest) => {
          const closed = closePane(latest, paneId);
          return previousPaneId ? focusPane(closed, previousPaneId) : closed;
        });
      }
      return;
    }
    if (stillEmpty && !paneShowing(current, cell)) {
      updateWorkspace((latest) => setCell(latest, paneId, cell));
    }
    if (cell.draftId !== null) fileDraftUnderPane(cell.draftId, paneId);
  };
  // One at a time: upstream's new thread gives up when the route moves while
  // it works, so a second ⌘T pressed meanwhile waits for the first.
  const openQueue = useRef(Promise.resolve());
  const openCellInto = (change: (current: Workspace) => Workspace) => {
    openQueue.current = openQueue.current.then(() => openCellNow(change));
  };

  const isLastPane = () => {
    const current = readWorkspace();
    return current.tabs.length === 1 && panesOf(current.tabs[0]!).length === 1;
  };

  useWorkspaceKeys({
    newTab: () => {
      openCellInto((current) => openTab(current, newIds(), null));
      return true;
    },
    closeTab: () => {
      const current = readWorkspace();
      if (!current.activeTabId || current.tabs.length < 2) return false;
      closeTabAndRoute(current.activeTabId);
      return true;
    },
    splitRight: () => {
      if (!focusedPane(readWorkspace())) return false;
      const width = gridRef.current?.clientWidth ?? window.innerWidth;
      openCellInto((current) => splitRight(current, newIds(), width));
      return true;
    },
    splitDown: () => {
      if (!focusedPane(readWorkspace())) return false;
      openCellInto((current) => splitDown(current, newIds()));
      return true;
    },
    closePane: () => {
      const pane = focusedPane(readWorkspace());
      // The last pane of the last tab is left to upstream: on the desktop, ⌘W closes the window.
      if (!pane || isLastPane()) return false;
      updateWorkspace((current) => closePane(current, pane.id));
      routeToFocused();
      return true;
    },
  });

  const keepGrid = isIndexRoute && tab !== null && focusedPresence.liveness !== "gone";
  if (props.target === null && !keepGrid) return props.fallback;
  if (!tab) return null;

  // The pane that renders the route as upstream would: the one showing its
  // chat, or the focused pane for a chat just routed to. A route already
  // taken in whose pane has closed is on its way out; no pane renders it.
  const routeHolder = routeCell ? paneShowing(workspace, routeCell) : null;
  const routeIsNew = routeCell !== null && routeKey(routeCell) !== takenRoute;
  const routeOwnerId =
    props.target === null ? null : (routeHolder?.pane.id ?? (routeIsNew ? focused?.id : null));

  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none md:h-dvh">
      <TabStrip
        tabs={workspace.tabs}
        activeTabId={workspace.activeTabId}
        onActivate={activateTabAndRoute}
        onClose={(tabId) => {
          if (readWorkspace().tabs.length > 1) closeTabAndRoute(tabId);
        }}
        onMove={(tabId, toIndex) => updateWorkspace((current) => moveTab(current, tabId, toIndex))}
        onNew={() => openCellInto((current) => openTab(current, newIds(), null))}
      />
      <div ref={gridRef} className="flex min-h-0 flex-1 flex-col">
        {tab.rows.map((row, rowIndex) => (
          <div key={row.id} className={cn("flex min-h-0 flex-1", rowIndex > 0 && "border-t")}>
            {row.columns.map((column, columnIndex) => (
              <div
                key={column.id}
                className={cn("flex min-w-0 flex-1 flex-col", columnIndex > 0 && "border-l")}
              >
                {column.panes.map((pane, paneIndex) => (
                  <PaneSlot
                    key={pane.id}
                    pane={pane}
                    stacked={paneIndex > 0}
                    focused={pane.id === tab.focusedPaneId}
                    showsFocus={panesOf(tab).length > 1}
                    routeTarget={pane.id === routeOwnerId ? props.target : null}
                    onFocus={focusPaneAndRoute}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </SidebarInset>
  );
}

function PaneSlot(props: {
  pane: Pane;
  stacked: boolean;
  focused: boolean;
  showsFocus: boolean;
  /** Set on the pane the URL names: it renders the route as upstream would. */
  routeTarget: ThreadRouteTarget | null;
  onFocus: (paneId: string) => void;
}) {
  const presence = useCellPresence(props.pane.cell);
  // Other panes render only a chat that still exists, so upstream's view never
  // leaves the route on their behalf (it does for a chat that is gone).
  const target =
    props.routeTarget ??
    (presence.liveness === "alive" && props.pane.cell ? presence.target : null);
  return (
    <div
      data-stemcells-pane={props.pane.id}
      data-focused={props.focused}
      onPointerDownCapture={() => {
        if (!props.focused) props.onFocus(props.pane.id);
      }}
      className={cn(
        // Upstream's thread view sizes itself to the window; a pane sizes it to the pane.
        "relative flex min-h-0 min-w-0 flex-1 flex-col [&>main]:h-full!",
        props.stacked && "border-t",
        props.showsFocus &&
          props.focused &&
          "after:pointer-events-none after:absolute after:inset-0 after:z-20 after:ring-1 after:ring-ring/40 after:ring-inset",
      )}
    >
      {target ? (
        <ChatPaneView target={target} ownsWindowInput={props.focused} />
      ) : props.pane.cell !== null && presence.liveness === "gone" ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>This Cell is gone</EmptyTitle>
            <EmptyDescription>Its chat was deleted. ⌘W closes the pane.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
    </div>
  );
}
