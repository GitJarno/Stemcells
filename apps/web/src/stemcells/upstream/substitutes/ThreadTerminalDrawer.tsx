// Replaces `components/ThreadTerminalDrawer.tsx` (`plugin.ts`): a chat's
// terminal drawer opens at about ten rows, not upstream's 280px, and its
// buttons get a row of their own over the terminal (`stemcells/terminal`).
// A height the person drags to stays theirs, stored as upstream stores it.
import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";

import UpstreamThreadTerminalDrawer from "../../../components/ThreadTerminalDrawer";
import { defaultDrawerHeight } from "../../terminal/drawerHeight";
import "../../terminal/terminal.css";
import { TERMINAL_GRID_PADDING, UPSTREAM_DRAWER_HEIGHT, useTerminalRowHeight } from "../terminal";

export * from "../../../components/ThreadTerminalDrawer";

/** The drawer's top edge, in px. */
const DRAWER_EDGE = 1;

export default function ThreadTerminalDrawer(
  props: ComponentProps<typeof UpstreamThreadTerminalDrawer>,
) {
  const rowHeight = useTerminalRowHeight();
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Measured once, before the drawer first draws: upstream reads the height
  // it is given when it mounts, and keeps it until the person drags.
  const [opening, setOpening] = useState<number | null>(null);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (opening !== null || host === null) return;
    const band = Number.parseFloat(getComputedStyle(host).getPropertyValue("--sc-terminal-band"));
    const pane = host.closest<HTMLElement>("[data-stemcells-pane]");
    setOpening(
      defaultDrawerHeight({
        rowHeight,
        chrome: DRAWER_EDGE + (Number.isFinite(band) ? band : 0) + 2 * TERMINAL_GRID_PADDING,
        paneHeight: pane === null ? null : pane.clientHeight,
      }),
    );
  }, [opening, rowHeight]);
  // Upstream stores its own height for a chat when the drawer first opens, so
  // a drawer at that height was never dragged. The right panel's terminal
  // fills the panel, at no height of its own.
  const atUpstreamHeight = props.mode !== "panel" && props.height === UPSTREAM_DRAWER_HEIGHT;
  const height = atUpstreamHeight ? opening : props.height;
  return (
    <div ref={hostRef} data-stemcells-terminal="" className="contents">
      {height === null ? null : <UpstreamThreadTerminalDrawer {...props} height={height} />}
    </div>
  );
}
