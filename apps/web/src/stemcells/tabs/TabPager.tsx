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
import { ProxyTrack } from "./ProxyTrack";

/**
 * The tabs' pages on one strip, and the two-finger swipe between them: a native scroll of their
 * proxy that the strip follows on the compositor (`pageStrip.ts`). Only the page on stage takes
 * input. While pages move, `[data-stemcells-pages]` carries `data-moving` for what can't move
 * with them; the new Cell's tab follows its page through `--stemcells-shown` (0 to 1).
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
  /** The page the strip is headed for, as a swipe aims at it and before it lands. */
  onAim?: (tabId: string) => void;
  /** A `PagerPage` for each tab whose page is mounted, the active one among them. */
  children: ReactNode;
}) {
  const [strip] = useState(() => new PageStrip());
  const proxyRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Attach the page strip to its proxy; detach on unmount.
  useLayoutEffect(() => {
    if (proxyRef.current === null || holdRef.current === null || stripRef.current === null) return;
    strip.attach(proxyRef.current, holdRef.current, stripRef.current);
    return () => strip.detach();
  }, [strip]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hand the strip this render's tabs and callbacks before paint.
  useLayoutEffect(() => {
    strip.aimed(props.onAim ?? NO_AIM);
    strip.sync(props.tabIds, props.activeId, props.onTurn, {
      id: props.newCellId ?? NO_NEW_CELL.id,
      tab: props.newTabRef ?? NO_NEW_CELL.tab,
      onMotion: props.onMotion ?? NO_NEW_CELL.onMotion,
    });
  });

  return (
    <div ref={proxyRef} data-stemcells-pages="" data-stemcells-proxy="">
      <ProxyTrack>
        <div ref={holdRef} data-stemcells-hold="">
          <div ref={stripRef} data-stemcells-strip="">
            <PageStripContext value={strip}>{props.children}</PageStripContext>
          </div>
        </div>
      </ProxyTrack>
    </div>
  );
}

const NO_AIM = () => undefined;

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
