/**
 * Where a carried chat would land (stemcells/tasks/windows.md, Carry a
 * chat), as plain geometry: the pane under the hand and the half of it the
 * hand is nearest, in whatever units the rects and the hand share.
 */
import type { PaneSide } from "../tabs/layout";
import type { Rect } from "./arrangement";
import type { StripPlace } from "./bridge";
import type { Point } from "./carry";

/** A pane a chat can land beside. */
export interface PanePlace {
  readonly paneId: string;
  readonly rect: Rect;
}

export interface PaneLanding {
  readonly anchor: string;
  readonly side: PaneSide;
  /** The half of the anchor the chat would take, which the wash lights. */
  readonly half: Rect;
}

const inside = (rect: Rect, at: Point) =>
  at.x >= rect.x && at.x < rect.x + rect.width && at.y >= rect.y && at.y < rect.y + rect.height;

/**
 * The side of `rect` the hand is nearest, measured across the pane's own
 * width and height: the pane cut along its diagonals.
 */
export function sideAt(rect: Rect, at: Point): PaneSide {
  const across = (at.x - rect.x) / rect.width;
  const down = (at.y - rect.y) / rect.height;
  const nearest = Math.min(across, 1 - across, down, 1 - down);
  if (nearest === across) return "left";
  if (nearest === 1 - across) return "right";
  return nearest === down ? "above" : "below";
}

/** The half of `rect` on `side`. */
export function halfOf(rect: Rect, side: PaneSide): Rect {
  const width = rect.width / 2;
  const height = rect.height / 2;
  switch (side) {
    case "left":
      return { ...rect, width };
    case "right":
      return { ...rect, x: rect.x + width, width };
    case "above":
      return { ...rect, height };
    case "below":
      return { ...rect, y: rect.y + height, height };
  }
}

/**
 * Where the chat carried out of `carried` lands with the hand at `at`: a
 * half of the pane under it. Over its own place, or over no pane, nowhere:
 * let go there, it goes back.
 */
export function paneLandingAt(
  panes: ReadonlyArray<PanePlace>,
  carried: string,
  at: Point,
): PaneLanding | null {
  const pane = panes.find((place) => inside(place.rect, at));
  if (!pane || pane.paneId === carried) return null;
  const side = sideAt(pane.rect, at);
  return { anchor: pane.paneId, side, half: halfOf(pane.rect, side) };
}

/** A chip a chat can rest on to open its tab. */
export interface ChipPlace {
  readonly tabId: string;
  readonly rect: Rect;
}

/** On the strip: a chip to spring open, or the strip's end, where a new tab goes. */
export type StripLanding =
  | { readonly kind: "chip"; readonly tabId: string }
  | { readonly kind: "end" };

/**
 * What the strip offers a carried chat with the hand at `at`: the chip
 * under it, or past the last chip, a new tab. Between chips, or off the
 * strip, nothing.
 */
export function stripLandingAt(
  strip: Rect,
  chips: ReadonlyArray<ChipPlace>,
  at: Point,
): StripLanding | null {
  if (!inside(strip, at)) return null;
  const chip = chips.find(({ rect }) => at.x >= rect.x && at.x < rect.x + rect.width);
  if (chip) return { kind: "chip", tabId: chip.tabId };
  const end = Math.max(strip.x, ...chips.map(({ rect }) => rect.x + rect.width));
  return at.x >= end ? { kind: "end" } : null;
}

/** Another window's chip a carried chat would go into, in screen points. */
export interface ChipElsewhere {
  readonly window: string;
  readonly tabId: string;
  readonly chip: Rect;
  /** How wide the tab's row shows in its window. */
  readonly rowWidth: number;
}

/**
 * The chip under the hand (`at`, screen points, outside the chat's own
 * window) in another window's strip, the whole strip's height: in the
 * front-most window under the hand, as the person sees it. Anywhere else,
 * nothing.
 */
export function chipElsewhereAt(
  places: ReadonlyArray<StripPlace>,
  at: Point,
): ChipElsewhere | null {
  const place = places.find(({ frame }) => inside(frame, at));
  if (!place) return null;
  const landing = stripLandingAt(place.strip.rect, place.strip.chips, at);
  if (landing?.kind !== "chip") return null;
  const chip = place.strip.chips.find(({ tabId }) => tabId === landing.tabId)!;
  return { window: place.id, tabId: chip.tabId, chip: chip.rect, rowWidth: chip.rowWidth };
}
