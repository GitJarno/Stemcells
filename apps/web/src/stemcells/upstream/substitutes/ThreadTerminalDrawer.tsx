// Replaces `components/ThreadTerminalDrawer.tsx` (`plugin.ts`): a chat's
// terminal drawer opens at about ten rows, not upstream's 280px, and its
// buttons get a row of their own over the terminal (`stemcells/terminal`).
// A height the person drags to stays theirs, stored as upstream stores it.
// Where upstream's panels don't move, the drawer moves on our motion, which
// its style plays (`useDrawerMotion`).
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";

import UpstreamThreadTerminalDrawer from "../../../components/ThreadTerminalDrawer";
import { usePanelAnimationSettings } from "../../../panelAnimations";
import { defaultDrawerHeight } from "../../terminal/drawerHeight";
import "../../tokens/stemcells.css";
import "../../terminal/terminal.css";
import {
  TERMINAL_GRID_PADDING,
  UPSTREAM_DRAWER_HEIGHT,
  terminalJustOpened,
  useDrawerMotion,
  useTerminalRowHeight,
} from "../terminal";

export * from "../../../components/ThreadTerminalDrawer";

/** The drawer's top edge, in px. */
const DRAWER_EDGE = 1;

export default function ThreadTerminalDrawer(
  props: ComponentProps<typeof UpstreamThreadTerminalDrawer>,
) {
  const rowHeight = useTerminalRowHeight();
  const motion = useDrawerMotion(usePanelAnimationSettings());
  const drawer = props.mode !== "panel";
  // It slides in when its terminal just opened; drawn as its chat comes
  // back with the terminal open, it is simply there, and moves from then on.
  const [slidesIn] = useState(() => terminalJustOpened(props.threadRef));
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
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
  const atUpstreamHeight = drawer && props.height === UPSTREAM_DRAWER_HEIGHT;
  const height = atUpstreamHeight ? opening : props.height;
  return (
    <div
      ref={hostRef}
      data-stemcells-terminal={drawer ? "drawer" : "panel"}
      data-moves={drawer && motion.ours && motion.active && (slidesIn || drawn) ? "" : undefined}
      className="contents"
    >
      {height === null ? null : <UpstreamThreadTerminalDrawer {...props} height={height} />}
    </div>
  );
}
