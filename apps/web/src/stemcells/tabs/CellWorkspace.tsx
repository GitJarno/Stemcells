import {
  Fragment,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { AskiKeeper, AskiPane } from "../aski/AskiPane";
import { AskiMomentWatch } from "../aski/moments/AskiMomentWatch";
import { EnvSlotHost, LineSlotHost } from "../composer/LineSlotHost";
import { ComposerStashSlot } from "../composer/slot";
import { AskiSpawn } from "../aski/AskiSpawn";
import { showMarksWhileScrolling } from "../scrollIndicator/scrollIndicator";
import { growSides } from "../split/grow";
import { Separator, type Axis } from "../split/Separator";
import { raiseSlate } from "../surfaces/awake";
import type { AskiChat } from "../upstream/aski";
import { ChatPaneView, useCellPresence, useOpenNewCell } from "../upstream/chat";
import { PanelMaximizedContext } from "../upstream/chatPanel";
import { dropLeftDraft, fileDraftUnderPane, useCellForRoute } from "../upstream/drafts";
import { useIsIndexRoute, useNavigateToCell, type ThreadRouteTarget } from "../upstream/routes";
import { useDetailsClosedAtFirst } from "../upstream/threadDetails";
import { cn, Empty, EmptyDescription, EmptyHeader, EmptyTitle, SidebarInset } from "../upstream/ui";
import { seatAskiHere } from "../windows/askiHome";
import { WindowsKeeper } from "../windows/WindowsKeeper";
import { EmptyWorkbenchClose, Look } from "../workbench/LookFrame";
import {
  addPaneOutsideAski,
  ASKI_TAB_ID,
  closeTabUnlessAski,
  isAskiTab,
  moveTabAfterAski,
  seatAski,
  showRouteBesideAski,
  splitDownOutsideAski,
  splitRightOutsideAski,
} from "./askiTab";
import { DropWash } from "./DropWash";
import { provideNewCellPane, provideNewCellTab } from "./commands";
import {
  activateTab,
  activeTab,
  closePane,
  evenOut,
  findPane,
  focusedPane,
  focusPane,
  MIN_COLUMN_WIDTH,
  MIN_PANE_HEIGHT,
  nameTab,
  openTab,
  panesOf,
  paneShowing,
  resizePair,
  rowFloor,
  sameChat,
  setCell,
  sharesOf,
  type CellRef,
  type Pane,
  type Tab,
  type Workspace,
} from "./layout";
import { keepEndAcrossWidth } from "./keepEnd";
import { holdTranscriptsStill } from "./stillTranscripts";
import { newCellTab, newCellTaken, takeNewCell, type NewCell } from "./newCell";
import { mountedTabs } from "./pager";
import { CellPill, PaneButtons } from "./PaneButtons";
import { PaneCellContext, PaneComposerContext } from "./paneCell";
import { newIds, readWorkspace, updateWorkspace, useWorkspaceStore } from "./store";
import { PagerPage, TabPager } from "./TabPager";
import { TabStrip } from "./TabStrip";
import { useNewCell } from "./useNewCell";
import { useWorkspaceKeys } from "./useWorkspaceKeys";
import "../tokens/stemcells.css";
import "./workspace.css";

function routeKey(cell: CellRef): string {
  return `${cell.environmentId}/${cell.threadId}/${cell.draftId ?? ""}`;
}

function cellsOf(workspace: Workspace): CellRef[] {
  return workspace.tabs.flatMap((tab) => panesOf(tab).flatMap((pane) => pane.cell ?? []));
}

/** Whether `cell` is the new Cell's draft. */
function isNewCellDraft(cell: CellRef, newCell: NewCell | null): boolean {
  return newCell !== null && cell.draftId !== null && cell.draftId === newCell.cell.draftId;
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
  const visited = useWorkspaceStore((store) => store.visited);
  const newCell = useWorkspaceStore((store) => store.newCell);
  // A turn renders the arriving page's ownership at once; the pages that
  // become its neighbours mount after, without holding up the slide.
  const settledTabId = useDeferredValue(workspace.activeTabId);
  const routeCell = useCellForRoute(props.target);
  const isIndexRoute = useIsIndexRoute();
  const navigateToCell = useNavigateToCell();
  const openNewCell = useOpenNewCell();
  const gridRef = useRef<HTMLDivElement>(null);
  const tab = activeTab(workspace);
  const focused = focusedPane(workspace);
  const focusedPresence = useCellPresence(focused?.cell ?? null);
  const [askiChat, setAskiChat] = useState<AskiChat>({ status: "starting" });
  // A swipe grants no user activation the way a click or a key does, so it
  // is counted here: either means the person has acted since the app opened.
  const swiped = useRef(false);
  useEffect(() => {
    const onWheel = () => {
      swiped.current = true;
    };
    window.addEventListener("wheel", onWheel, { passive: true, once: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);
  const newTabRef = useRef<HTMLDivElement>(null);
  const newCellIsTaken = newCellTaken(workspace, newCell);
  const lastTabOnStage =
    workspace.tabs.length > 0 && workspace.tabs.at(-1)?.id === workspace.activeTabId;
  const newCellMotion = useNewCell(lastTabOnStage && !newCellIsTaken).motion;
  // From here on, a browser off stage sleeps until it is wanted (`awake.ts`).
  useLayoutEffect(raiseSlate, []);

  const routeToFocused = () => {
    const cell = focusedPane(readWorkspace())?.cell;
    if (cell) navigateToCell(cell, { replace: true });
  };

  const onRoute = useEffectEvent((cell: CellRef) => {
    // The new Cell's draft, routed to (a reload, the sidebar): its tab is taken.
    const routedNewCell = useWorkspaceStore.getState().newCell;
    const ofNewCell = isNewCellDraft(cell, routedNewCell);
    updateWorkspace((current) =>
      ofNewCell && routedNewCell !== null
        ? takeNewCell(current, routedNewCell)
        : showRouteBesideAski(current, cell, newIds()),
    );
    useWorkspaceStore.setState({ takenRoute: routeKey(cell) });
    const holder = paneShowing(readWorkspace(), cell);
    // The new Cell's draft stays under its own key until it is sent.
    if (holder && cell.draftId !== null && !ofNewCell) {
      fileDraftUnderPane(cell.draftId, holder.pane.id);
    }
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

  // A draft that left every pane goes too, unless something was written in
  // it. The new Cell's stays, for the next swipe past the last tab. One a
  // move took to another window hasn't left.
  useEffect(
    () =>
      useWorkspaceStore.subscribe((state, previous) => {
        if (state.moved) return;
        const kept = cellsOf(state.workspace);
        for (const cell of cellsOf(previous.workspace)) {
          if (kept.some((other) => sameChat(other, cell))) continue;
          if (isNewCellDraft(cell, state.newCell) || isNewCellDraft(cell, previous.newCell)) {
            continue;
          }
          dropLeftDraft(cell);
        }
      }),
    [],
  );

  const focusPaneAndRoute = (paneId: string) => {
    updateWorkspace((current) => focusPane(current, paneId));
    routeToFocused();
  };

  const activateTabAndRoute = (tabId: string) => {
    // The new Cell's page, gone to: its tab is taken, and the route goes to its draft.
    const current = useWorkspaceStore.getState().newCell;
    updateWorkspace((latest) =>
      current !== null && tabId === current.ids.tab
        ? takeNewCell(latest, current)
        : activateTab(latest, tabId),
    );
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

  const gridWidth = () => gridRef.current?.clientWidth ?? window.innerWidth;

  const openNewTab = () => openCellInto((current) => openTab(current, newIds(), null));
  const provideNewTab = useEffectEvent(openNewTab);
  useEffect(() => provideNewCellTab(() => provideNewTab()), []);

  const openNewPane = () =>
    openCellInto((current) => addPaneOutsideAski(current, newIds(), gridWidth()));
  const provideNewPane = useEffectEvent(openNewPane);
  useEffect(() => provideNewCellPane(() => provideNewPane()), []);

  /**
   * Aski's chat, once it exists, goes in Aski's tab, in the window that holds
   * it (stemcells/windows); the first time, the app opens on it.
   */
  const onAskiChat = (chat: AskiChat) => {
    setAskiChat(chat);
    if (chat.status !== "ready") return;
    seatAskiHere(readWorkspace(), () => {
      const before = readWorkspace();
      const acted = swiped.current || (navigator.userActivation?.hasBeenActive ?? false);
      updateWorkspace((current) => seatAski(current, chat.cell, newIds(), acted));
      if (!isAskiTab(activeTab(before)) && isAskiTab(activeTab(readWorkspace()))) routeToFocused();
    });
  };

  /** A pane's ×: closes it, and the route follows the pane focused after. */
  const closePaneAndRoute = (paneId: string) => {
    updateWorkspace((current) => closePane(current, paneId));
    routeToFocused();
  };

  const isLastPane = () => {
    const current = readWorkspace();
    return current.tabs.length === 1 && panesOf(current.tabs[0]!).length === 1;
  };

  useWorkspaceKeys({
    newCell: () => {
      openNewPane();
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
      const width = gridWidth();
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
  const keeper = (
    <>
      <AskiKeeper onChat={onAskiChat} />
      <AskiMomentWatch aski={askiChat.status === "ready" ? askiChat.cell : null} />
      <AskiSpawn />
      <WindowsKeeper onMoved={routeToFocused} />
    </>
  );
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

  // The new Cell's page is the strip's last, taken or not.
  const workspaceTabIds = workspace.tabs.map((candidate) => candidate.id);
  const untakenNewCell = newCell !== null && !newCellIsTaken ? newCell : null;
  const tabIds = untakenNewCell ? [...workspaceTabIds, untakenNewCell.ids.tab] : workspaceTabIds;
  const tabOf = (tabId: string): Tab | undefined =>
    workspace.tabs.find((candidate) => candidate.id === tabId) ??
    (untakenNewCell && tabId === untakenNewCell.ids.tab ? newCellTab(untakenNewCell) : undefined);
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
        newCell={newCell ? { tab: newCellTab(newCell), taken: newCellIsTaken } : null}
        newTabRef={newTabRef}
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
        onNew={openNewTab}
        onRename={(tabId, name) => updateWorkspace((current) => nameTab(current, tabId, name))}
      />
      <div data-stemcells-slate="">
        {tab === null ? (
          <div data-stemcells-page="">
            <div data-stemcells-grid="">
              <AskiPane
                chat={askiChat}
                target={null}
                ownsWindowInput={false}
                focused={false}
                panelHost={null}
              />
            </div>
          </div>
        ) : (
          <TabPager
            tabIds={tabIds}
            activeId={tab.id}
            onTurn={activateTabAndRoute}
            newCellId={newCell?.ids.tab ?? null}
            newTabRef={newTabRef}
            onMotion={newCellMotion}
          >
            {mountedTabs(tabIds, tab.id, settledTabId, visited).map((tabId) => {
              const pageTab = tabOf(tabId);
              if (!pageTab) return null;
              const onStage = tabId === tab.id;
              return (
                <PagerPage key={tabId} tabId={tabId} onStage={onStage}>
                  <TabPage
                    tab={pageTab}
                    onStage={onStage}
                    aski={isAskiTab(pageTab) ? askiChat : null}
                    routeOwnerId={routeOwnerId ?? null}
                    routeTarget={props.target}
                    gridRef={gridRef}
                    onFocus={focusPaneAndRoute}
                    onClose={
                      // Aski's pane never closes, nor the last pane of the last tab.
                      isAskiTab(pageTab) ||
                      (workspace.tabs.length === 1 && panesOf(pageTab).length === 1)
                        ? null
                        : closePaneAndRoute
                    }
                  />
                </PagerPage>
              );
            })}
          </TabPager>
        )}
        <DropWash />
      </div>
    </SidebarInset>
  );
}

/**
 * One tab's page on the slate: its panes, and at its right edge its
 * workbench, which the focused chat's surfaces fill while the page is on
 * stage. Off stage, a page shows its chats as they are but owns no input.
 */
function TabPage(props: {
  tab: Tab;
  onStage: boolean;
  /** Set on Aski's tab: Aski's chat as it stands. */
  aski: AskiChat | null;
  /** The pane the URL names, which renders the route as upstream would. */
  routeOwnerId: string | null;
  routeTarget: ThreadRouteTarget | null;
  /** Set to the grid of the page on stage. */
  gridRef: RefObject<HTMLDivElement | null>;
  onFocus: (paneId: string) => void;
  /** Closes a pane of the tab; null where none may close. */
  onClose: ((paneId: string) => void) | null;
}) {
  const { tab } = props;
  const [workbench, setWorkbench] = useState<HTMLDivElement | null>(null);
  // How many of the page's chats have their panel maximized: one at most,
  // counted so that a hand-over from one chat to another never drops it.
  const [maximized, setMaximized] = useState(0);
  const rowShares = sharesOf(tab.rows);
  return (
    <PanelMaximizedContext value={(on) => setMaximized((count) => count + (on ? 1 : -1))}>
      {/* Look: the focused Cell and its workbench take the page (stemcells/workbench). */}
      <Look tab={tab} onStage={props.onStage} workbench={workbench} onFocus={props.onFocus} />
      <EmptyWorkbenchClose tab={tab} onStage={props.onStage} workbench={workbench} />
      {/* Each row, column and pane grows by its share; between each two, a border resizes them.
          Its attributes say what `:has()` would find, which restyled it all (`workspace.css`). */}
      <div
        ref={props.onStage ? props.gridRef : undefined}
        data-stemcells-grid=""
        data-many={panesOf(tab).length > 1 ? "" : undefined}
        data-maximized-away={maximized > 0 ? "" : undefined}
      >
        {tab.rows.map((row, rowIndex) => {
          const columnShares = sharesOf(row.columns);
          return (
            <Fragment key={row.id}>
              {rowIndex > 0 ? (
                <Border
                  axis="y"
                  parentId={tab.id}
                  index={rowIndex - 1}
                  shares={rowShares}
                  floors={[rowFloor(tab.rows[rowIndex - 1]!), rowFloor(row)]}
                />
              ) : null}
              <div
                data-stemcells-share=""
                className={cn("flex min-h-0 flex-1", rowIndex > 0 && "border-t")}
                style={{ flexGrow: rowShares[rowIndex] }}
              >
                {row.columns.map((column, columnIndex) => {
                  const paneShares = sharesOf(column.panes);
                  return (
                    <Fragment key={column.id}>
                      {columnIndex > 0 ? (
                        <Border
                          axis="x"
                          parentId={row.id}
                          index={columnIndex - 1}
                          shares={columnShares}
                          floors={[MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH]}
                        />
                      ) : null}
                      <div
                        data-stemcells-share=""
                        className={cn(
                          "flex min-w-0 flex-1 flex-col",
                          columnIndex > 0 && "border-l",
                        )}
                        style={{ flexGrow: columnShares[columnIndex] }}
                      >
                        {column.panes.map((pane, paneIndex) => (
                          <Fragment key={pane.id}>
                            {paneIndex > 0 ? (
                              <Border
                                axis="y"
                                parentId={column.id}
                                index={paneIndex - 1}
                                shares={paneShares}
                                floors={[MIN_PANE_HEIGHT, MIN_PANE_HEIGHT]}
                              />
                            ) : null}
                            <PaneSlot
                              pane={pane}
                              share={paneShares[paneIndex]!}
                              aski={props.aski}
                              stacked={paneIndex > 0}
                              focused={pane.id === tab.focusedPaneId}
                              ownsInput={props.onStage && pane.id === tab.focusedPaneId}
                              routeTarget={
                                pane.id === props.routeOwnerId ? props.routeTarget : null
                              }
                              panelHost={workbench}
                              onFocus={props.onFocus}
                              onClose={props.onClose}
                            />
                          </Fragment>
                        ))}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </Fragment>
          );
        })}
      </div>
      {/* The tab's workbench: the focused chat's surfaces (stemcells/upstream/chatPanel). */}
      <div
        ref={setWorkbench}
        data-stemcells-workbench=""
        data-maximized={maximized > 0 ? "" : undefined}
      />
    </PanelMaximizedContext>
  );
}

/**
 * The border before a parent's child at `index + 1`: dragged, it shares out
 * what the two beside it had; double-clicked, it evens out the parent.
 */
function Border(props: {
  axis: Axis;
  /** The tab (for its rows), the row (its columns) or the column (its panes). */
  parentId: string;
  index: number;
  shares: number[];
  floors: [number, number];
}) {
  const { parentId, index } = props;
  return (
    <Separator
      axis={props.axis}
      label={props.axis === "x" ? "Cell width" : "Cell height"}
      shares={[props.shares[index]!, props.shares[index + 1]!]}
      sides={{
        ...growSides(
          props.axis,
          props.floors,
          (lengths) =>
            updateWorkspace((current) =>
              resizePair(current, parentId, index, lengths.before, lengths.after),
            ),
          () => updateWorkspace((current) => evenOut(current, parentId)),
        ),
        // Only a sideways move re-wraps what the Cells show.
        ...(props.axis === "x" ? { still: holdTranscriptsStill } : {}),
      }}
    />
  );
}

/**
 * A pane keeps a chat read to its end at its end as the pane's width
 * changes, and shows the chat's scroll indicator while it scrolls: in
 * Aski's pane too.
 */
function attachPane(pane: HTMLDivElement | null) {
  if (!pane) return undefined;
  const stopKeepingEnd = keepEndAcrossWidth(pane);
  const stopShowingMarks = showMarksWhileScrolling(pane);
  return () => {
    stopKeepingEnd();
    stopShowingMarks();
  };
}

function PaneSlot(props: {
  pane: Pane;
  /** Its share of its column's height. */
  share: number;
  /** Set on Aski's pane: Aski's chat as it stands. */
  aski: AskiChat | null;
  stacked: boolean;
  /** The tab's focused pane. Its composer shows it, never a ring round the pane. */
  focused: boolean;
  /** The focused pane of the page on stage: it owns window input and the workbench. */
  ownsInput: boolean;
  /** Set on the pane the URL names: it renders the route as upstream would. */
  routeTarget: ThreadRouteTarget | null;
  /** The tab's workbench, which the focused pane's surfaces fill. */
  panelHost: HTMLElement | null;
  onFocus: (paneId: string) => void;
  onClose: ((paneId: string) => void) | null;
}) {
  const presence = useCellPresence(props.pane.cell);
  const { onClose } = props;
  // Other panes render only a chat that still exists, so upstream's view never
  // leaves the route on their behalf (it does for a chat that is gone).
  const target =
    props.routeTarget ??
    (presence.liveness === "alive" && props.pane.cell ? presence.target : null);
  useDetailsClosedAtFirst(target);
  // How many composers are drawn in the pane (`PaneComposerContext`).
  const [composers, setComposers] = useState(0);
  return (
    <div
      ref={attachPane}
      data-stemcells-pane={props.pane.id}
      data-stemcells-share=""
      data-focused={props.focused}
      onPointerDownCapture={() => {
        if (!props.focused) props.onFocus(props.pane.id);
      }}
      className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col", props.stacked && "border-t")}
      style={{ flexGrow: props.share }}
    >
      {props.aski ? (
        <AskiPane
          chat={props.aski}
          target={target}
          ownsWindowInput={props.ownsInput}
          focused={props.focused}
          panelHost={props.panelHost}
        />
      ) : (
        <>
          {/* No header: the line over the composer names the Cell, and the
              pane's buttons float at its top-right (PaneButtons). */}
          <PaneButtons
            cell={props.pane.cell}
            onClose={onClose ? () => onClose(props.pane.id) : null}
          />
          {/* With no composer drawn, no composer's line names the Cell: a pill does. */}
          {props.pane.cell && composers === 0 ? <CellPill cell={props.pane.cell} /> : null}
          {/* Upstream's thread view sizes itself to the window; a pane sizes it to the pane. */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col [&>main]:h-full!">
            {target ? (
              <PaneCellContext value={props.pane.cell}>
                <PaneComposerContext
                  value={(drawn) => setComposers((count) => count + (drawn ? 1 : -1))}
                >
                  <EnvSlotHost>
                    <LineSlotHost slot={ComposerStashSlot}>
                      <ChatPaneView
                        target={target}
                        ownsWindowInput={props.ownsInput}
                        focused={props.focused}
                        panelHost={props.panelHost}
                      />
                    </LineSlotHost>
                  </EnvSlotHost>
                </PaneComposerContext>
              </PaneCellContext>
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
