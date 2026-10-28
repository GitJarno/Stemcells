/**
 * A window's strip as host of a tab carried from another window, or of a chat carried by its
 * Cell to a new tab (stemcells/tasks/windows.md, Into another window's strip): it measures
 * itself when a pick-up asks, makes room where the tab would land, and keeps the arrived tab's
 * chip hidden until what was carried lands on it. A chat carried over a chip lights it.
 */
import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

import type { Tab } from "../tabs/layout";
import { motionTiming } from "../tokens/motion";
import { windowsBridge, type PageRect, type Visit } from "./bridge";

/** The tab list's `gap-1`, in CSS pixels. */
export const TAB_GAP = 4;

/** A carried tab over this strip: where it would land and how wide it is, in screen points. */
interface Room {
  readonly tabId: string;
  readonly width: number;
  readonly slot: number;
}

interface Hosting {
  readonly room: Room | null;
  /** The room just closed: the chips slide back rather than jump. */
  readonly closing: boolean;
  /** The chip a chat carried from another window would go into. */
  readonly lit: string | null;
}

const bridge = windowsBridge();
let hosting: Hosting = { room: null, closing: false, lit: null };
let closed: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: Hosting): void {
  hosting = next;
  for (const listener of listeners) listener();
}

/**
 * A tab carried over this strip: room for it at its slot, it arrived (its
 * chip shows), or it left (null, the chips glide back). Or a chat carried
 * over a chip, which lights.
 */
export function hostRoom(visit: Visit | null): void {
  clearTimeout(closed);
  const closing = hosting.room !== null;
  if (visit === null) {
    set({ room: null, closing, lit: null });
    closed = setTimeout(
      () => set({ room: null, closing: false, lit: null }),
      motionTiming("travel").duration,
    );
    return;
  }
  if ("lit" in visit) {
    set({ room: null, closing, lit: visit.tabId });
    return;
  }
  if ("arrived" in visit) {
    // The still has landed on the chip: it shows, and once it's drawn the still goes.
    set({ room: null, closing: false, lit: null });
    requestAnimationFrame(() => requestAnimationFrame(() => bridge?.drawn()));
    return;
  }
  set({ room: visit, closing: false, lit: null });
}

bridge?.onRoom(hostRoom);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const read = () => hosting;

/**
 * What the strip does for a tab carried to it: each chip's offset as it makes room (CSS
 * pixels), how far the strip grows to hold the room so what follows moves over too, the
 * arrived tab's chip hidden until what was carried lands on it, and whether the chips glide
 * (`travel`). And the chip a chat carried from another window lights.
 */
export function useHosting(shownTabs: ReadonlyArray<Tab>): {
  readonly offsets: ReadonlyArray<number> | null;
  readonly grows: number;
  readonly hiddenId: string | null;
  readonly gliding: boolean;
  readonly lit: string | null;
} {
  const { room, closing, lit } = useSyncExternalStore(subscribe, read, read);
  if (!room) return { offsets: null, grows: 0, hiddenId: null, gliding: closing, lit };
  // In the workspace already (the move was made): it sits in its slot, hidden.
  if (shownTabs.some((tab) => tab.id === room.tabId)) {
    return { offsets: null, grows: 0, hiddenId: room.tabId, gliding: false, lit };
  }
  const shift = room.width / (bridge?.zoom() ?? 1) + TAB_GAP;
  return {
    offsets: shownTabs.map((_, index) => (index >= room.slot ? shift : 0)),
    grows: shift,
    hiddenId: null,
    gliding: true,
    lit,
  };
}

/**
 * How wide tab `tabId`'s row shows in this window: its grid's width where
 * its page is drawn, else the slate's, which every page fills.
 */
export function tabRowWidth(tabId: string): number {
  const grid = document.querySelector<HTMLElement>(
    `[data-stemcells-page="${CSS.escape(tabId)}"] [data-stemcells-grid]`,
  );
  if (grid && grid.clientWidth > 0) return grid.clientWidth;
  return (
    document.querySelector<HTMLElement>("[data-stemcells-slate]")?.clientWidth ?? window.innerWidth
  );
}

const pageRect = (element: Element): PageRect => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
};

/**
 * Answers a carry in another window that asks where this strip is: its
 * rect, the Cells' chips in order with how wide each tab's row shows, and
 * where a first chip would sit (the new Cell's place, when there is no
 * chip), in this page's CSS pixels.
 */
export function useStripMeasure(
  strip: RefObject<HTMLElement | null>,
  tabElements: RefObject<Map<string, HTMLElement>>,
  tabs: ReadonlyArray<Tab>,
  newCellTabId: string | null,
): void {
  const latest = useRef(tabs);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep the latest tabs in a ref for the bridge's measure callback.
  useEffect(() => {
    latest.current = tabs;
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Answer the desktop bridge's measure requests while mounted and unregister on unmount.
  useEffect(() => {
    if (!bridge) return;
    return bridge.onMeasure(() => {
      const element = strip.current;
      if (!element) return null;
      const chips = latest.current.flatMap((tab) => {
        const chip = tabElements.current.get(tab.id);
        return chip ? [{ tabId: tab.id, rect: pageRect(chip), rowWidth: tabRowWidth(tab.id) }] : [];
      });
      const phantom = newCellTabId ? tabElements.current.get(newCellTabId) : undefined;
      const rect = pageRect(element);
      const start = chips[0]?.rect.left ?? (phantom ? pageRect(phantom).left : rect.left);
      return { zoom: bridge.zoom(), rect, chips, gap: TAB_GAP, start };
    });
  }, [strip, tabElements, newCellTabId]);
}
