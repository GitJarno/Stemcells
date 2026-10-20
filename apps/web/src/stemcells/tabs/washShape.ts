/**
 * The drop wash's shape (`DropWash.tsx`): where it stands over a pane, and
 * which of its corners follow the slate's. As plain geometry, so it is
 * tested without a page.
 */

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Each corner's radius, in pixels, clockwise from the top left. */
export interface Corners {
  readonly topLeft: number;
  readonly topRight: number;
  readonly bottomRight: number;
  readonly bottomLeft: number;
}

/**
 * Panes meet the slate's edge exactly, or a hairline apart from a
 * neighbour, so half a pixel says "this edge is the slate's".
 */
const SLACK = 0.5;

/** The pane, in the slate's own coordinates, drawn `inset` inside its edges. */
export function washBox(pane: Box, slate: Box, inset: number): Box {
  return {
    left: pane.left - slate.left + inset,
    top: pane.top - slate.top + inset,
    width: Math.max(0, pane.width - inset * 2),
    height: Math.max(0, pane.height - inset * 2),
  };
}

/**
 * A corner rounds where the pane's corner is the slate's own, by the
 * slate's radius less the inset, so the wash runs parallel to the slate's
 * curve; a corner a pane shares with its neighbours stays square.
 */
export function washCorners(pane: Box, slate: Box, radius: number, inset: number): Corners {
  const left = pane.left <= slate.left + SLACK;
  const right = pane.left + pane.width >= slate.left + slate.width - SLACK;
  const top = pane.top <= slate.top + SLACK;
  const bottom = pane.top + pane.height >= slate.top + slate.height - SLACK;
  const round = Math.max(0, radius - inset);
  return {
    topLeft: top && left ? round : 0,
    topRight: top && right ? round : 0,
    bottomRight: bottom && right ? round : 0,
    bottomLeft: bottom && left ? round : 0,
  };
}
