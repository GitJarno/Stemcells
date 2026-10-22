import { Plus } from "lucide-react";
import { useRef, useState, type RefObject } from "react";

import { ASKI_UNAVAILABLE } from "../aski/AskiPane";
import { NeedsTabCount } from "../needs/NeedsTabCount";
import { RenameField } from "../rename/RenameField";
import type { AskiChat } from "../upstream/aski";
import { canRenameCell, useCellRename } from "../upstream/chatHeader";
import { useCellTitle } from "../upstream/thread";
import {
  Button,
  cn,
  PanelTabCloseButton,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "../upstream/ui";
import { ASKI_TAB_ID } from "./askiTab";
import { CellMark } from "./CellMark";
import { panesOf, type CellRef, type Tab } from "./layout";
import { useCarryLit } from "../windows/ChatCarry";
import { GatherButton } from "../windows/GatherButton";
import { useFlownChips } from "../windows/gatherFlight";
import { useHosting, useStripMeasure } from "../windows/hostStrip";
import { useTabCarry } from "../windows/useTabCarry";
import { useSpringTabs, type SpringHandlers } from "./springTab";
import { restingOffsets } from "./tabDrag";
import "./drop.css";

export function TabStrip(props: {
  /** The Cells' tabs; Aski's is drawn on its own, before them. */
  tabs: ReadonlyArray<Tab>;
  activeTabId: string | null;
  aski: { readonly active: boolean; readonly cell: CellRef | null; readonly chat: AskiChat };
  /**
   * The new Cell past the last tab (`newCell.ts`): its tab, and whether it
   * is taken (then it is among `tabs`). Its tab is last, and shows only as
   * much as its page does (`TabPager` sets `--stemcells-shown` through
   * `newTabRef`).
   */
  newCell: { readonly tab: Tab; readonly taken: boolean } | null;
  newTabRef: RefObject<HTMLDivElement | null>;
  /** How many tabs the window holds, Aski's among them: its only tab carries the window itself. */
  windowTabs: number;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onMove: (tabId: string, toIndex: number) => void;
  onNew: () => void;
  /** Names a tab of more than one Cell; null gives it back its focused chat's name. */
  onRename: (tabId: string, name: string | null) => void;
}) {
  const tabElements = useRef(new Map<string, HTMLElement>());
  const stripRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const { tabs, onActivate, onMove } = props;
  // A tab a drag rests on opens, so a file can be carried to another tab's chat.
  const spring = useSpringTabs(props.activeTabId, onActivate);
  // A chat carried by its Cell lights the chip it would go into.
  const carryLit = useCarryLit();
  const carry = useTabCarry({
    tabs,
    activeTabId: props.activeTabId,
    tabElements,
    strip: stripRef,
    windowTabs: props.windowTabs,
    // Unsent, the new Cell's tab is no tab of the workspace's to carry off.
    staysId: props.newCell?.taken ? props.newCell.tab.id : null,
    onActivate,
    onMove,
  });
  const { view } = carry;
  // Where the others sit: making room for the carried tab's slot, or closed
  // up after it while it's off the strip in the open.
  const offsets = view?.picked
    ? restingOffsets(
        view.geometry,
        view.away === "open" ? view.geometry.widths.length - 1 : view.slot,
      )
    : null;
  const { newCell, newTabRef } = props;
  // In one list with the tabs, so taking or leaving the new Cell keeps its tab's element.
  const shownTabs = newCell && !newCell.taken ? [...tabs, newCell.tab] : tabs;
  // A tab carried from another window: this strip makes room for it, then
  // takes it. A chat carried from another window lights a chip.
  const hosting = useHosting(shownTabs);
  // Tabs Gather brought here or Put back takes away, while their chips are on the flight layer.
  const flown = useFlownChips();
  useStripMeasure(stripRef, tabElements, tabs, newCell && !newCell.taken ? newCell.tab.id : null);

  return (
    <div
      ref={stripRef}
      className="flex h-9 shrink-0 items-center gap-1 pr-2"
      data-stemcells-tab-strip=""
    >
      <div
        className="flex min-w-0 items-center gap-1"
        role="tablist"
        style={{
          // The room a carried tab is given: what follows the chips moves over with them.
          paddingInlineEnd: hosting.grows,
          transition: hosting.gliding
            ? "padding-inline-end var(--sc-motion-travel-duration) var(--sc-motion-travel-easing)"
            : undefined,
        }}
      >
        <AskiChip
          {...props.aski}
          onActivate={() => onActivate(ASKI_TAB_ID)}
          springLit={spring.lit === ASKI_TAB_ID}
          springHandlers={spring.handlers(ASKI_TAB_ID)}
        />
        {shownTabs.map((tab, index) => {
          const dragged = view?.picked === true && view.tabId === tab.id;
          // Off the strip, its chip is on the flight layer and its place here is empty.
          const away = dragged && view.away !== "no";
          const offset =
            dragged && !away ? view.offset : (offsets?.[index] ?? hosting.offsets?.[index] ?? 0);
          const isNewCell = tab.id === newCell?.tab.id;
          // Not yet taken, the new Cell's tab only opens: there is no tab to drag or close.
          const untaken = isNewCell && !newCell.taken;
          return (
            <div
              key={tab.id}
              ref={(element) => {
                if (element) tabElements.current.set(tab.id, element);
                else tabElements.current.delete(tab.id);
                if (isNewCell) newTabRef.current = element;
              }}
              role="tab"
              aria-selected={tab.id === props.activeTabId}
              data-stemcells-tab={tab.id}
              data-stemcells-new-tab={isNewCell ? "" : undefined}
              data-spring-lit={
                spring.lit === tab.id || carryLit === tab.id || hosting.lit === tab.id
              }
              data-dragged={dragged || undefined}
              {...spring.handlers(tab.id)}
              onPointerDown={(event) => {
                // A press on its × or in its name being edited is theirs.
                if (event.button !== 0 || (event.target as Element).closest("button, input")) {
                  return;
                }
                // The click never waits on a carry: a press none takes (the new
                // Cell's tab, unsent, or any while something else is in the hand)
                // opens the tab at once.
                if (untaken || !carry.onPointerDown(event, tab.id)) onActivate(tab.id);
              }}
              onPointerMove={carry.onPointerMove}
              onPointerUp={carry.onPointerUp}
              onPointerCancel={carry.onPointerCancel}
              onDoubleClick={(event) => {
                // Its first click opened the tab; Aski's tab and the new Cell's are never renamed.
                if (untaken || (event.target as Element).closest("button, input")) return;
                if (panesOf(tab).length > 1 || canRenameCell(focusedCellOf(tab))) {
                  setRenaming(tab.id);
                }
              }}
              style={
                away || tab.id === hosting.hiddenId || flown.has(tab.id)
                  ? { visibility: "hidden" }
                  : dragged
                    ? { transform: `translate(${offset}px, ${view.pulled}px) scale(1.04)` }
                    : offset !== 0 || view?.picked || hosting.gliding
                      ? {
                          transform: `translateX(${offset}px)`,
                          // The others make room and close up on `travel`.
                          transition:
                            "transform var(--sc-motion-travel-duration) var(--sc-motion-travel-easing)",
                        }
                      : undefined
              }
              className={cn(
                "group/tab flex h-6 w-40 min-w-0 shrink cursor-pointer select-none items-center gap-1.5 rounded-md pr-1 pl-1.5 text-xs",
                // Lifted off the strip, a dragged tab is opaque so the tabs it passes stay under it.
                dragged
                  ? "relative z-10 bg-popover text-foreground shadow-md ring-1 ring-border"
                  : tab.id === props.activeTabId
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <TabTitle
                tab={tab}
                renaming={renaming === tab.id}
                onRename={(name) => props.onRename(tab.id, name)}
                onDone={() => setRenaming(null)}
              />
              {tabs.length > 1 && !untaken ? (
                <PanelTabCloseButton label="Close tab" onClick={() => props.onClose(tab.id)}>
                  {null}
                </PanelTabCloseButton>
              ) : null}
            </div>
          );
        })}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon-xs" aria-label="New tab" onClick={props.onNew} />
          }
        >
          <Plus />
        </TooltipTrigger>
        <TooltipPopup>New tab</TooltipPopup>
      </Tooltip>
      <GatherButton className="ml-auto" />
    </div>
  );
}

function focusedCellOf(tab: Tab): CellRef | null {
  const panes = panesOf(tab);
  return (panes.find((pane) => pane.id === tab.focusedPaneId) ?? panes[0])?.cell ?? null;
}

/**
 * The tab's focused Cell: its character, then its name. A tab of one Cell
 * is that chat, and named by its title; a tab of more is named by the name
 * it was given, else by its focused chat's title, and counts its Cells.
 * Double-clicked, the name opens for a new one in place, as the one-liner's
 * does: in a tab of one Cell it renames the chat, wherever the chat shows.
 */
function TabTitle(props: {
  tab: Tab;
  renaming: boolean;
  onRename: (name: string | null) => void;
  onDone: () => void;
}) {
  const panes = panesOf(props.tab);
  const cell = focusedCellOf(props.tab);
  const title = useCellTitle(cell) ?? "New Cell";
  const many = panes.length > 1;
  const name = many ? (props.tab.name ?? title) : title;
  const count = many ? (
    <span className="shrink-0 text-muted-foreground"> · {panes.length}</span>
  ) : null;
  if (props.renaming) {
    return (
      <>
        <CellMark cell={cell} />
        {many ? (
          <RenameField
            value={name}
            label="Tab name"
            className={TAB_RENAME}
            onCommit={(value) => {
              props.onDone();
              const given = value.trim();
              if (given !== name) props.onRename(given.length > 0 ? given : null);
            }}
            onCancel={props.onDone}
          />
        ) : (
          <ChatRename cell={cell} title={title} onDone={props.onDone} />
        )}
        {count}
      </>
    );
  }
  return (
    <>
      <CellMark cell={cell} />
      <span className="min-w-0 flex-1 truncate">
        {name}
        {count}
      </span>
    </>
  );
}

/** The field takes the name's room in the tab, its text where the name's was. */
const TAB_RENAME = "-ml-1 h-5 flex-1 px-1";

/** A tab of one Cell renames its chat. */
function ChatRename(props: { cell: CellRef | null; title: string; onDone: () => void }) {
  const { commitRename } = useCellRename(props.cell);
  return (
    <RenameField
      value={props.title}
      label="Title"
      className={TAB_RENAME}
      onCommit={(value) => {
        // Not applied (its chat not loaded here yet): the field stays, with what was typed, saying why.
        const refused = commitRename(value);
        if (refused === undefined) props.onDone();
        return refused;
      }}
      onCancel={props.onDone}
    />
  );
}

/**
 * Aski's tab: the fixed first place in the strip. It never drags or closes.
 * Until Aski's chat exists it can't be opened, and says why.
 */
function AskiChip(props: {
  active: boolean;
  cell: CellRef | null;
  chat: AskiChat;
  onActivate: () => void;
  springLit: boolean;
  springHandlers: SpringHandlers;
}) {
  if (props.cell !== null) {
    return (
      <div
        role="tab"
        aria-selected={props.active}
        data-stemcells-tab={ASKI_TAB_ID}
        data-spring-lit={props.springLit}
        {...props.springHandlers}
        onClick={props.onActivate}
        className={cn(
          "flex h-6 shrink-0 cursor-pointer select-none items-center rounded-md px-2 text-xs font-medium",
          props.active
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        Aski
        <NeedsTabCount />
      </div>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            aria-disabled
            data-stemcells-tab={ASKI_TAB_ID}
            className="flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground/70"
          />
        }
      >
        Aski
      </TooltipTrigger>
      <TooltipPopup>
        {props.chat.status === "unavailable"
          ? ASKI_UNAVAILABLE[props.chat.reason]
          : "Aski is getting its chat ready."}
      </TooltipPopup>
    </Tooltip>
  );
}
