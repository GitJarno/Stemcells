import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";

import { AskiKeeper, AskiPane } from "../aski/AskiPane";
import type { AskiChat } from "../upstream/aski";
import { ChatPaneView, useCellPresence, useCellTitle, useOpenNewCell } from "../upstream/chat";
import { dropLeftDraft, fileDraftUnderPane, useCellForRoute } from "../upstream/drafts";
import { useIsIndexRoute, useNavigateToCell, type ThreadRouteTarget } from "../upstream/routes";
import { cn, Empty, EmptyDescription, EmptyHeader, EmptyTitle, SidebarInset } from "../upstream/ui";
import {
  ASKI_TAB_ID,
  closeTabUnlessAski,
  isAskiTab,
  moveTabAfterAski,
  seatAski,
  showRouteBesideAski,
  splitDownOutsideAski,
  splitRightOutsideAski,
} from "./askiTab";
import { CellMark } from "./CellMark";
import {
  activateTab,
  activeTab,
  closePane,
  findPane,
  focusedPane,
  focusPane,
  openTab,
  panesOf,
  paneShowing,
  sameChat,
  setCell,
  type CellRef,
  type Pane,
  type Workspace,
} from "./layout";
import { newIds, readWorkspace, updateWorkspace, useWorkspaceStore } from "./store";
import { TabStrip } from "./TabStrip";
import { useWorkspaceKeys } from "./useWorkspaceKeys";
import "../tokens/stemcells.css";
import "./workspace.css";

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
  const [askiChat, setAskiChat] = useState<AskiChat>({ status: "starting" });

  const routeToFocused = () => {
    const cell = focusedPane(readWorkspace())?.cell;
    if (cell) navigateToCell(cell, { replace: true });
  };

  const onRoute = useEffectEvent((cell: CellRef) => {
    updateWorkspace((current) => showRouteBesideAski(current, cell, newIds()));
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
    updateWorkspace((current) => closeTabUnlessAski(current, tabId));
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

  const inAskiTab = () => isAskiTab(activeTab(readWorkspace()));

  /** Aski's chat, once it exists, goes in Aski's tab; the first time, the app opens on it. */
  const onAskiChat = (chat: AskiChat) => {
    setAskiChat(chat);
    if (chat.status !== "ready") return;
    const before = readWorkspace();
    updateWorkspace((current) => seatAski(current, chat.cell, newIds()));
    if (!isAskiTab(activeTab(before)) && isAskiTab(activeTab(readWorkspace()))) routeToFocused();
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
      if (!current.activeTabId || current.tabs.length < 2 || inAskiTab()) return false;
      closeTabAndRoute(current.activeTabId);
      return true;
    },
    splitRight: () => {
      if (!focusedPane(readWorkspace()) || inAskiTab()) return false;
      const width = gridRef.current?.clientWidth ?? window.innerWidth;
      openCellInto((current) => splitRightOutsideAski(current, newIds(), width));
      return true;
    },
    splitDown: () => {
      if (!focusedPane(readWorkspace()) || inAskiTab()) return false;
      openCellInto((current) => splitDownOutsideAski(current, newIds()));
      return true;
    },
    closePane: () => {
      const pane = focusedPane(readWorkspace());
      // The last pane of the last tab is left to upstream: on the desktop, ⌘W
      // closes the window. So is Aski's, which never closes.
      if (!pane || isLastPane() || inAskiTab()) return false;
      updateWorkspace((current) => closePane(current, pane.id));
      routeToFocused();
      return true;
    },
  });

  // On the index route Aski's chat is on its way: the grid waits for it
  // rather than letting upstream's index start a draft beside it.
  const askiOnTheWay = isIndexRoute && askiChat.status === "starting" && tab === null;
  const keepGrid =
    isIndexRoute && ((tab !== null && focusedPresence.liveness !== "gone") || askiOnTheWay);
  const keeper = <AskiKeeper onChat={onAskiChat} />;
  if (props.target === null && !keepGrid) {
    return (
      <>
        {keeper}
        {props.fallback}
      </>
    );
  }
  if (!tab && !askiOnTheWay) return keeper;

  // The pane that renders the route as upstream would: the one showing its
  // chat, or the focused pane for a chat just routed to. A route already
  // taken in whose pane has closed is on its way out; no pane renders it.
  const routeHolder = routeCell ? paneShowing(workspace, routeCell) : null;
  const routeIsNew = routeCell !== null && routeKey(routeCell) !== takenRoute;
  const routeOwnerId =
    props.target === null ? null : (routeHolder?.pane.id ?? (routeIsNew ? focused?.id : null));

  const askiTab = workspace.tabs.find(isAskiTab) ?? null;
  const cellTabs = askiTab
    ? workspace.tabs.filter((candidate) => candidate !== askiTab)
    : workspace.tabs;

  return (
    <SidebarInset
      data-stemcells-workspace=""
      className="h-svh min-h-0 overflow-hidden overscroll-y-none md:h-dvh"
    >
      {keeper}
      <TabStrip
        tabs={cellTabs}
        activeTabId={workspace.activeTabId}
        aski={{
          active: askiTab !== null && workspace.activeTabId === ASKI_TAB_ID,
          cell: askiTab ? (panesOf(askiTab)[0]?.cell ?? null) : null,
          chat: askiChat,
        }}
        onActivate={activateTabAndRoute}
        onClose={(tabId) => {
          if (readWorkspace().tabs.length > 1) closeTabAndRoute(tabId);
        }}
        onMove={(tabId, toIndex) =>
          // The strip counts the Cells' tabs; Aski's comes before them.
          updateWorkspace((current) =>
            moveTabAfterAski(current, tabId, toIndex + (askiTab ? 1 : 0)),
          )
        }
        onNew={() => openCellInto((current) => openTab(current, newIds(), null))}
      />
      <div ref={gridRef} className="flex min-h-0 flex-1 flex-col">
        {tab === null ? <AskiPane chat={askiChat} target={null} ownsWindowInput={false} /> : null}
        {tab?.rows.map((row, rowIndex) => (
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
                    aski={isAskiTab(tab) ? askiChat : null}
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
  /** Set on Aski's pane: Aski's chat as it stands. */
  aski: AskiChat | null;
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
        "relative flex min-h-0 min-w-0 flex-1 flex-col",
        props.stacked && "border-t",
        props.showsFocus &&
          props.focused &&
          "after:pointer-events-none after:absolute after:inset-0 after:z-20 after:ring-1 after:ring-ring/40 after:ring-inset",
      )}
    >
      {props.aski ? (
        <AskiPane chat={props.aski} target={target} ownsWindowInput={props.focused} />
      ) : (
        <>
          {props.showsFocus ? <PaneHeader cell={props.pane.cell} /> : null}
          {/* Upstream's thread view sizes itself to the window; a pane sizes it to the pane. */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col [&>main]:h-full!">
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
        </>
      )}
    </div>
  );
}

/** Names a pane's Cell when a tab holds more than one. */
function PaneHeader(props: { cell: CellRef | null }) {
  const title = useCellTitle(props.cell) ?? "New Cell";
  return (
    <div
      data-stemcells-pane-header=""
      className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-2 text-xs text-muted-foreground"
    >
      <CellMark cell={props.cell} />
      <span className="min-w-0 truncate">{title}</span>
    </div>
  );
}
