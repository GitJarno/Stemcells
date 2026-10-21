import { Plus } from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import { ASKI_UNAVAILABLE } from "../aski/AskiPane";
import { NeedsTabCount } from "../needs/NeedsTabCount";
import type { AskiChat } from "../upstream/aski";
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
import { useSpringTabs, type SpringHandlers } from "./springTab";
import { clampOffset, nearestSlot, restingOffsets, type TabDragGeometry } from "./tabDrag";
import "./drop.css";

/** A press that moves less than this is a click, not a drag. */
const DRAG_START_DISTANCE = 4;
/** The tab list's `gap-1`, which the drag geometry needs in pixels. */
const TAB_GAP = 4;

interface Drag {
  readonly tabId: string;
  readonly pointerId: number;
  readonly startX: number;
  readonly geometry: TabDragGeometry | null;
  readonly offset: number;
  readonly slot: number;
}

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
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onMove: (tabId: string, toIndex: number) => void;
  onNew: () => void;
}) {
  const tabElements = useRef(new Map<string, HTMLElement>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const { tabs, onActivate, onMove } = props;
  // A tab a drag rests on opens, so a file can be carried to another tab's chat.
  const spring = useSpringTabs(props.activeTabId, onActivate);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, tabId: string) => {
    if (event.button !== 0 || (event.target as Element).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const from = tabs.findIndex((tab) => tab.id === tabId);
    setDrag({
      tabId,
      pointerId: event.pointerId,
      startX: event.clientX,
      geometry: null,
      offset: 0,
      slot: from,
    });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const rawOffset = event.clientX - drag.startX;
    let geometry = drag.geometry;
    if (!geometry) {
      if (Math.abs(rawOffset) < DRAG_START_DISTANCE) return;
      // Measured once: the strip holds still while a tab rides the pointer.
      geometry = {
        widths: tabs.map((tab) => tabElements.current.get(tab.id)?.offsetWidth ?? 0),
        gap: TAB_GAP,
        from: tabs.findIndex((tab) => tab.id === drag.tabId),
      };
    }
    const offset = clampOffset(geometry, rawOffset);
    setDrag({ ...drag, geometry, offset, slot: nearestSlot(geometry, offset, drag.slot) });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (!drag.geometry) onActivate(drag.tabId);
    else if (drag.slot !== drag.geometry.from) onMove(drag.tabId, drag.slot);
  };

  const offsets = drag?.geometry ? restingOffsets(drag.geometry, drag.slot) : null;
  const { newCell, newTabRef } = props;
  // In one list with the tabs, so taking or leaving the new Cell keeps its tab's element.
  const shownTabs = newCell && !newCell.taken ? [...tabs, newCell.tab] : tabs;

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 px-2" data-stemcells-tab-strip="">
      <div className="flex min-w-0 items-center gap-1" role="tablist">
        <AskiChip
          {...props.aski}
          onActivate={() => onActivate(ASKI_TAB_ID)}
          springLit={spring.lit === ASKI_TAB_ID}
          springHandlers={spring.handlers(ASKI_TAB_ID)}
        />
        {shownTabs.map((tab, index) => {
          const dragged = drag?.geometry != null && drag.tabId === tab.id;
          const offset = dragged ? drag.offset : (offsets?.[index] ?? 0);
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
              data-spring-lit={spring.lit === tab.id}
              {...spring.handlers(tab.id)}
              onPointerDown={(event) => {
                if (!untaken) onPointerDown(event, tab.id);
                else if (event.button === 0) onActivate(tab.id);
              }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              style={
                offset !== 0 || dragged
                  ? { transform: `translateX(${offset}px)${dragged ? " scale(1.04)" : ""}` }
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
                drag?.geometry && !dragged && "transition-transform",
              )}
            >
              <TabTitle tab={tab} />
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
    </div>
  );
}

/** The tab's focused Cell: its character, then its chat's title. */
function TabTitle(props: { tab: Tab }) {
  const panes = panesOf(props.tab);
  const focused = panes.find((pane) => pane.id === props.tab.focusedPaneId) ?? panes[0];
  const title = useCellTitle(focused?.cell ?? null) ?? "New Cell";
  return (
    <>
      <CellMark cell={focused?.cell ?? null} />
      <span className="min-w-0 flex-1 truncate">
        {title}
        {panes.length > 1 ? <span className="text-muted-foreground"> · {panes.length}</span> : null}
      </span>
    </>
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
