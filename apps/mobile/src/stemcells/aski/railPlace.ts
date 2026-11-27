// Where our buttons stand in the Duo's side rail, as UIKit lays its own there (measured on the
// Duo): after the top group the screen in front names, never into the tabs. Pure; the store
// that hears the top group is `rail.ts`.

/** A header item as T3's header converts it for react-native-screens. */
interface RailItem {
  readonly type: string;
  readonly id: string;
}

/** The buttons a header stands in the rail: no spacers, and not the keyboard's dismiss, which Aski hides under anyway. */
export function railButtons(items: ReadonlyArray<RailItem>, searchButton: boolean): number {
  return (
    items.filter((item) => item.type === "item" && item.id !== "dismiss-keyboard").length +
    (searchButton ? 1 : 0)
  );
}

/** The rail's measure: points from the window's top, per posture (measured on the Duo). */
export const RAIL = {
  /** UIKit sets the rail's buttons on a line 14 pt in from the screen's edge. */
  edgeInset: 14,
  /** Its tab group starts 0.649 of the way down in every posture. */
  tabsStart: 0.649,
  gap: 14,
  /** Where the top group centres its first button, and how far below each next one stands. */
  unfolded: { start: 156, pitch: 63 },
  folded: { start: 198, pitch: 60 },
} as const;

/**
 * Where the n-th of our `ours` buttons (0, 1, …) centres, from the window's top: after the top
 * group's buttons, a pitch apart, as if they were the group's own. Never into the tabs: there
 * the last of ours stands just above them and the rest above it.
 */
export function railCentre(input: {
  readonly regular: boolean;
  readonly windowHeight: number;
  readonly top: number | null;
  readonly index: number;
  readonly ours: number;
  readonly size: number;
}): number {
  const { start, pitch } = input.regular ? RAIL.unfolded : RAIL.folded;
  const lowest = input.windowHeight * RAIL.tabsStart - RAIL.gap - input.size / 2;
  const fromBottom = lowest - (input.ours - 1 - input.index) * pitch;
  // Before any header says, two (a chat's new chat and code), where most rails stand.
  const top = input.top ?? 2;
  return Math.min(start + (top + input.index) * pitch, fromBottom);
}

type Metrics = {
  readonly verticalBarEdge: string;
  readonly horizontalSizeClass: string;
  readonly safeArea: { readonly left: number; readonly right: number };
} | null;

/** Where the n-th of our `ours` buttons stands in the rail, as a layer's absolute place; null without a rail wide enough. */
export function railStyle(input: {
  readonly metrics: Metrics;
  readonly window: { readonly height: number };
  readonly top: number | null;
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
    regular: metrics.horizontalSizeClass === "regular",
    windowHeight: input.window.height,
    top: input.top,
    index: input.index,
    ours: input.ours,
    size,
  });
  const side = (rail + RAIL.edgeInset - size) / 2;
  const top = centre - size / 2;
  return edge === "right" ? { right: side, top } : { left: side, top };
}
