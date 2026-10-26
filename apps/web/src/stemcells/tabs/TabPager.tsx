import {
  createContext,
  use,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { NO_NEW_CELL, PageStrip } from "./pageStrip";

/**
 * The tabs' pages side by side on one strip, and the two-finger swipe between them: one transform
 * written a frame, nothing re-rendering. Only the page on stage takes pointer, keys and focus.
 * While pages move, `[data-stemcells-pages]` carries `data-moving` for what can't move with them
 * (a native view). The new Cell's tab follows its page through `--stemcells-shown` (0 to 1).
 */
export function TabPager(props: {
  /** Every tab, in the strip's order: a tab's place is its index. */
  tabIds: readonly string[];
  activeId: string;
  /** Turns to a tab a swipe went to. */
  onTurn: (tabId: string) => void;
  /** The new Cell's page, among `tabIds`, if there is one. */
  newCellId?: string | null;
  /** Its tab in the tab bar. */
  newTabRef?: RefObject<HTMLElement | null>;
  /** The pages started moving, or came to rest (`data-moving`). */
  onMotion?: (moving: boolean) => void;
  /** A `PagerPage` for each tab whose page is mounted, the active one among them. */
  children: ReactNode;
}) {
  const [strip] = useState(() => new PageStrip());
  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // oxlint-disable-next-line t3code/react-effect-budget -- Attach the page strip to its viewport; detach on unmount.
  useLayoutEffect(() => {
    if (viewportRef.current === null || stripRef.current === null) return;
    strip.attach(viewportRef.current, stripRef.current);
    return () => strip.detach();
  }, [strip]);

  // oxlint-disable-next-line t3code/react-effect-budget -- Hand the strip this render's tabs and callbacks before paint.
  useLayoutEffect(() => {
    strip.sync(props.tabIds, props.activeId, props.onTurn, {
      id: props.newCellId ?? NO_NEW_CELL.id,
      tab: props.newTabRef ?? NO_NEW_CELL.tab,
      onMotion: props.onMotion ?? NO_NEW_CELL.onMotion,
    });
  });

  return (
    <div ref={viewportRef} data-stemcells-pages="">
      <div ref={stripRef} data-stemcells-strip="">
        <PageStripContext value={strip}>{props.children}</PageStripContext>
      </div>
    </div>
  );
}

const PageStripContext = createContext<PageStrip | null>(null);

/** A tab's page on the strip. Only the one on stage takes input. */
export function PagerPage(props: { tabId: string; onStage: boolean; children: ReactNode }) {
  const strip = use(PageStripContext);
  const { tabId } = props;
  return (
    <div
      ref={(node) => {
        strip?.setPage(tabId, node);
        return () => strip?.setPage(tabId, null);
      }}
      data-stemcells-page={tabId}
      data-on-stage={props.onStage}
      inert={!props.onStage}
    >
      {props.children}
    </div>
  );
}
