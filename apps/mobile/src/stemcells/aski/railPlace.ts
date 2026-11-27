// Where our buttons stand in the Duo's side rail: over its tab group, the one thing in the rail
// that stays put. UIKit moves the top group (a screen's own buttons) as it likes: one to four of
// them by screen, and a Live Activity pushes them all down, with nothing to report where they
// went; a button placed after them landed among them (`stemcells/tasks/duo-collection.md`). Pure.

/** The rail's measure, in points (measured on the Duo, open and closed). */
export const RAIL = {
  /** UIKit sets the rail's buttons on a line 14 pt in from the screen's edge. */
  edgeInset: 14,
  /** Its tab group starts 0.649 of the way down in every posture. */
  tabsStart: 0.649,
  /** Between the tab group and the button over it, as between the rail's own groups. */
  gap: 14,
  /** From one of ours to the next, as UIKit spaces its own. */
  pitch: 60,
} as const;

/**
 * Where the n-th of our `ours` buttons (0, 1, …) centres, from the window's top: the last just
 * over the tabs, the rest above it.
 */
export function railCentre(input: {
  readonly windowHeight: number;
  readonly index: number;
  readonly ours: number;
  readonly size: number;
}): number {
  const lowest = input.windowHeight * RAIL.tabsStart - RAIL.gap - input.size / 2;
  return lowest - (input.ours - 1 - input.index) * RAIL.pitch;
}

type Metrics = {
  readonly verticalBarEdge: string;
  readonly safeArea: { readonly left: number; readonly right: number };
} | null;

/** Where the n-th of our `ours` buttons stands in the rail, as a layer's absolute place; null without a rail wide enough. */
export function railStyle(input: {
  readonly metrics: Metrics;
  readonly window: { readonly height: number };
  readonly index: number;
  readonly ours: number;
  readonly size: number;
}): { readonly top: number; readonly left?: number; readonly right?: number } | null {
  const { metrics, size } = input;
  const edge = metrics?.verticalBarEdge;
  if (metrics === null || (edge !== "left" && edge !== "right")) return null;
  const rail = edge === "right" ? metrics.safeArea.right : metrics.safeArea.left;
  if (rail < size) return null;
  const centre = railCentre({
    windowHeight: input.window.height,
    index: input.index,
    ours: input.ours,
    size,
  });
  const side = (rail + RAIL.edgeInset - size) / 2;
  const top = centre - size / 2;
  return edge === "right" ? { right: side, top } : { left: side, top };
}
