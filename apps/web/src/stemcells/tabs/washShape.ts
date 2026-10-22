/**
 * The drop wash's place (`DropWash.tsx`, and a carried chat's in
 * `ChatCarry.tsx`): where it stands over a pane or a half of one. As plain
 * geometry, so it is tested without a page.
 */

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * How far inside what it lights the wash stands, CSS px: a rounded sheet
 * floating clear of the pane's edges and the hairlines between panes.
 */
export const WASH_INSET = 6;

/** The pane, in the slate's own coordinates, drawn `inset` inside its edges. */
export function washBox(pane: Box, slate: Box, inset = WASH_INSET): Box {
  return {
    left: pane.left - slate.left + inset,
    top: pane.top - slate.top + inset,
    width: Math.max(0, pane.width - inset * 2),
    height: Math.max(0, pane.height - inset * 2),
  };
}
