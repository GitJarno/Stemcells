import { MessageSquare, Plus, Sparkles } from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { useCellTitle } from "../upstream/chat";
import {
  Button,
  cn,
  PanelTabCloseButton,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "../upstream/ui";
import { panesOf, type Tab } from "./layout";
import { clampOffset, nearestSlot, restingOffsets, type TabDragGeometry } from "./tabDrag";

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
  tabs: ReadonlyArray<Tab>;
  activeTabId: string | null;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onMove: (tabId: string, toIndex: number) => void;
  onNew: () => void;
}) {
  const tabElements = useRef(new Map<string, HTMLElement>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const { tabs, onActivate, onMove } = props;

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

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2"
      data-stemcells-tab-strip=""
    >
      <AskiSlot />
      <div className="flex min-w-0 items-center gap-1" role="tablist">
        {tabs.map((tab, index) => {
          const dragged = drag?.geometry != null && drag.tabId === tab.id;
          const offset = dragged ? drag.offset : (offsets?.[index] ?? 0);
          return (
            <div
              key={tab.id}
              ref={(element) => {
                if (element) tabElements.current.set(tab.id, element);
                else tabElements.current.delete(tab.id);
              }}
              role="tab"
              aria-selected={tab.id === props.activeTabId}
              data-stemcells-tab={tab.id}
              onPointerDown={(event) => onPointerDown(event, tab.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              style={
                offset !== 0 || dragged
                  ? { transform: `translateX(${offset}px)${dragged ? " scale(1.04)" : ""}` }
                  : undefined
              }
              className={cn(
                "group/tab flex h-6 w-40 min-w-0 shrink cursor-pointer select-none items-center gap-1 rounded-md pr-2 pl-1.5 text-xs",
                // Lifted off the strip, a dragged tab is opaque so the tabs it passes stay under it.
                dragged
                  ? "relative z-10 bg-popover text-foreground shadow-md ring-1 ring-border"
                  : tab.id === props.activeTabId
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                drag?.geometry && !dragged && "transition-transform",
              )}
            >
              {tabs.length > 1 ? (
                <PanelTabCloseButton label="Close tab" onClick={() => props.onClose(tab.id)}>
                  <MessageSquare className="size-3" />
                </PanelTabCloseButton>
              ) : (
                <MessageSquare className="size-3 shrink-0" />
              )}
              <TabTitle tab={tab} />
            </div>
          );
        })}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon-xs" aria-label="New Cell" onClick={props.onNew} />
          }
        >
          <Plus />
        </TooltipTrigger>
        <TooltipPopup>New Cell (⌘T)</TooltipPopup>
      </Tooltip>
    </div>
  );
}

function TabTitle(props: { tab: Tab }) {
  const panes = panesOf(props.tab);
  const focused = panes.find((pane) => pane.id === props.tab.focusedPaneId) ?? panes[0];
  const title = useCellTitle(focused?.cell ?? null) ?? "New Cell";
  return (
    <span className="min-w-0 truncate">
      {title}
      {panes.length > 1 ? <span className="text-muted-foreground"> · {panes.length}</span> : null}
    </span>
  );
}

/**
 * Aski's slot: the fixed first place in the strip. Aski arrives in a later
 * change; until then this holds the place, and it never drags or closes.
 */
function AskiSlot() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            aria-disabled
            data-stemcells-slot="aski"
            className="flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground/70"
          />
        }
      >
        <Sparkles className="size-3" />
        Aski
      </TooltipTrigger>
      <TooltipPopup>Aski arrives soon</TooltipPopup>
    </Tooltip>
  );
}
