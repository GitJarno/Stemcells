import { useEffect, useState, type DragEvent } from "react";

import { timing } from "../tokens/motion.ts";

/**
 * Spring-loaded tabs (the Mac app's): a tab a drag comes over lights, and
 * opens once the drag rests on it, so a file can be carried to a chat on
 * another tab. Leaving the tab, letting go or ending the drag puts it out.
 * Whatever the drag carries: the tab doesn't take the drop, the chat does.
 */
export class SpringTab {
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Opens the lit tab once the drag has rested; the latest drag event's. */
  private open: (tabId: string) => void = () => {};
  /** The tab lit now, if any. */
  lit: string | null = null;

  constructor(
    private readonly host: {
      /** The lit tab changed. */
      readonly onLit: (tabId: string | null) => void;
      /** How long a drag rests before the tab opens, ms. */
      readonly rest: () => number;
    },
  ) {}

  /** A drag is over `tabId`; `open` opens it. The tab already open never springs. */
  over(tabId: string, activeTabId: string | null, open: (tabId: string) => void): void {
    this.open = open;
    if (tabId === activeTabId) {
      this.out();
      return;
    }
    if (this.lit === tabId) return;
    this.out();
    this.lit = tabId;
    this.host.onLit(tabId);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.out();
      this.open(tabId);
    }, this.host.rest());
  }

  /** The drag left `tabId` (or, with none, ended). */
  out(tabId?: string): void {
    if (tabId !== undefined && tabId !== this.lit) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.lit === null) return;
    this.lit = null;
    this.host.onLit(null);
  }
}

/** What a tab spreads on itself to spring. */
export interface SpringHandlers {
  readonly onDragEnter: (event: DragEvent<HTMLElement>) => void;
  readonly onDragOver: (event: DragEvent<HTMLElement>) => void;
  readonly onDragLeave: (event: DragEvent<HTMLElement>) => void;
}

/** The lit tab, and each tab's drag handlers. */
export function useSpringTabs(
  activeTabId: string | null,
  open: (tabId: string) => void,
): { readonly lit: string | null; readonly handlers: (tabId: string) => SpringHandlers } {
  const [lit, setLit] = useState<string | null>(null);
  const [spring] = useState(
    () => new SpringTab({ onLit: setLit, rest: () => timing("springLoad") }),
  );

  // A drag let go or cancelled anywhere puts the light out.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hear drop and dragend on the window while a tab is lit.
  useEffect(() => {
    if (lit === null) return;
    const end = () => spring.out();
    window.addEventListener("drop", end, true);
    window.addEventListener("dragend", end, true);
    return () => {
      window.removeEventListener("drop", end, true);
      window.removeEventListener("dragend", end, true);
    };
  }, [lit, spring]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Put the light out when the tabs unmount.
  useEffect(() => () => spring.out(), [spring]);

  return {
    lit,
    handlers: (tabId) => ({
      onDragEnter: () => spring.over(tabId, activeTabId, open),
      onDragOver: () => spring.over(tabId, activeTabId, open),
      onDragLeave: (event) => {
        // Crossing onto the tab's own close button is still the tab.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        spring.out(tabId);
      },
    }),
  };
}
