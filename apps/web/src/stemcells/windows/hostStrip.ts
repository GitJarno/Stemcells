/**
 * A window's strip as the host of a tab carried from another window
 * (stemcells/tasks/windows.md, Into another window's strip): it measures
 * itself when a carry's pick-up asks, makes room where the tab would land,
 * and, once the tab is in its workspace, keeps its chip hidden until the
 * carried still has landed on it.
 */
import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

import type { Tab } from "../tabs/layout";
import { motionTiming } from "../tokens/motion";
import { windowsBridge, type PageRect } from "./bridge";

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
}

const bridge = windowsBridge();
let hosting: Hosting = { room: null, closing: false };
let closed: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: Hosting): void {
  hosting = next;
  for (const listener of listeners) listener();
}

bridge?.onRoom((visit) => {
  clearTimeout(closed);
  if (visit === null) {
    set({ room: null, closing: hosting.room !== null });
    closed = setTimeout(() => set({ room: null, closing: false }), motionTiming("travel").duration);
    return;
  }
  if ("arrived" in visit) {
    // The still has landed on the chip: it shows, and once it's drawn the still goes.
    set({ room: null, closing: false });
    requestAnimationFrame(() => requestAnimationFrame(() => bridge.drawn()));
    return;
  }
  set({ room: visit, closing: false });
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const read = () => hosting;

/**
 * What the strip does for a tab carried from another window: each chip's
 * offset as it makes room (CSS pixels), the arrived tab's chip kept hidden
 * until the still lands on it, and whether the chips glide (`travel`).
 */
export function useHosting(shownTabs: ReadonlyArray<Tab>): {
  readonly offsets: ReadonlyArray<number> | null;
  readonly hiddenId: string | null;
  readonly gliding: boolean;
} {
  const { room, closing } = useSyncExternalStore(subscribe, read, read);
  if (!room) return { offsets: null, hiddenId: null, gliding: closing };
  // In the workspace already (the move was made): it sits in its slot, hidden.
  if (shownTabs.some((tab) => tab.id === room.tabId)) {
    return { offsets: null, hiddenId: room.tabId, gliding: false };
  }
  const shift = room.width / (bridge?.zoom() ?? 1) + TAB_GAP;
  return {
    offsets: shownTabs.map((_, index) => (index >= room.slot ? shift : 0)),
    hiddenId: null,
    gliding: true,
  };
}

const pageRect = (element: Element): PageRect => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
};

/**
 * Answers a carry in another window that asks where this strip is: its
 * rect, the Cells' chips in order, and where a first chip would sit (the new
 * Cell's place, when there is no chip), in this page's CSS pixels.
 */
export function useStripMeasure(
  strip: RefObject<HTMLElement | null>,
  tabElements: RefObject<Map<string, HTMLElement>>,
  tabs: ReadonlyArray<Tab>,
  newCellTabId: string | null,
): void {
  const latest = useRef(tabs);
  useEffect(() => {
    latest.current = tabs;
  });
  useEffect(() => {
    if (!bridge) return;
    return bridge.onMeasure(() => {
      const element = strip.current;
      if (!element) return null;
      const chips = latest.current.flatMap((tab) => {
        const chip = tabElements.current.get(tab.id);
        return chip ? [{ tabId: tab.id, rect: pageRect(chip) }] : [];
      });
      const phantom = newCellTabId ? tabElements.current.get(newCellTabId) : undefined;
      const rect = pageRect(element);
      const start = chips[0]?.rect.left ?? (phantom ? pageRect(phantom).left : rect.left);
      return { zoom: bridge.zoom(), rect, chips, gap: TAB_GAP, start };
    });
  }, [strip, tabElements, newCellTabId]);
}
