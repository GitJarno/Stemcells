/**
 * Geometry for dragging a tab along the strip. Widths are measured once when
 * the drag starts; the strip itself doesn't move, so every slot is known up
 * front and the dragged tab only has to pick the nearest one.
 */

export interface TabDragGeometry {
  /** Each tab's width, in the strip's order when the drag started. */
  readonly widths: ReadonlyArray<number>;
  readonly gap: number;
  /** The dragged tab's index when the drag started. */
  readonly from: number;
}

/**
 * How far past the midpoint between two slots the dragged tab travels before
 * they swap, so a tab resting on the boundary doesn't flicker between them.
 */
export const SWAP_HYSTERESIS = 8;

function leftOf(widths: ReadonlyArray<number>, gap: number, index: number): number {
  let left = 0;
  for (let i = 0; i < index; i++) left += widths[i]! + gap;
  return left;
}

/** Widths of the other tabs with the dragged one placed at `slot`. */
function orderWithDraggedAt(geometry: TabDragGeometry, slot: number): number[] {
  const others = geometry.widths.filter((_, index) => index !== geometry.from);
  others.splice(slot, 0, geometry.widths[geometry.from]!);
  return others;
}

/** How far the dragged tab may travel each way and stay inside the strip. */
export function clampOffset(geometry: TabDragGeometry, offset: number): number {
  const { widths, gap, from } = geometry;
  const start = leftOf(widths, gap, from);
  const end = leftOf(widths, gap, widths.length - 1) + widths[widths.length - 1]!;
  return Math.max(-start, Math.min(offset, end - start - widths[from]!));
}

/** The slot the dragged tab should hold, `offset` px from where it started. */
export function nearestSlot(geometry: TabDragGeometry, offset: number, current: number): number {
  const { widths, gap, from } = geometry;
  const halfWidth = widths[from]! / 2;
  const center = leftOf(widths, gap, from) + offset + halfWidth;
  const distanceTo = (slot: number) =>
    Math.abs(center - (leftOf(orderWithDraggedAt(geometry, slot), gap, slot) + halfWidth));
  let best = current;
  for (let slot = 0; slot < widths.length; slot++) {
    if (distanceTo(slot) < distanceTo(best)) best = slot;
  }
  // Each pixel past the midpoint brings one slot a pixel closer and takes the other a pixel away.
  return distanceTo(current) - distanceTo(best) > 2 * SWAP_HYSTERESIS ? best : current;
}

/**
 * Where each tab, by its index when the drag started, sits while the dragged
 * one holds `slot`: an x offset from its resting place.
 */
export function restingOffsets(geometry: TabDragGeometry, slot: number): number[] {
  const { widths, gap, from } = geometry;
  const order = widths.map((_, index) => index).filter((index) => index !== from);
  order.splice(slot, 0, from);
  const offsets = widths.map(() => 0);
  let left = 0;
  for (const index of order) {
    offsets[index] = left - leftOf(widths, gap, index);
    left += widths[index]! + gap;
  }
  return offsets;
}
