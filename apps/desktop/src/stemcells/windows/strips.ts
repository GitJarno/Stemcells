/**
 * Stemcells: other windows' strips for a carry (stemcells/tasks/windows.md,
 * The carry engine). A page measures its own strip in its CSS pixels; the
 * main process places it on the screen from the window's content bounds and
 * the page's zoom, as the carry works in screen points.
 */
import type { FlightRect, MeasuredStrip, PageRect, StripPlace } from "./channels.ts";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function readPageRect(value: unknown): PageRect | null {
  if (typeof value !== "object" || value === null) return null;
  const { left, top, width, height } = value as Record<string, unknown>;
  return isNumber(left) && isNumber(top) && isNumber(width) && isNumber(height)
    ? { left, top, width, height }
    : null;
}

/** A strip as a page answered, or null when it isn't one. */
export function readMeasured(value: unknown): MeasuredStrip | null {
  if (typeof value !== "object" || value === null) return null;
  const { zoom, rect, chips, gap, start } = value as Record<string, unknown>;
  const strip = readPageRect(rect);
  if (!isNumber(zoom) || zoom <= 0 || !strip || !isNumber(gap) || !isNumber(start)) return null;
  if (!Array.isArray(chips)) return null;
  const read = chips.map((chip: unknown) => {
    const { tabId, rect: chipRect } = (chip ?? {}) as Record<string, unknown>;
    const at = readPageRect(chipRect);
    return typeof tabId === "string" && at ? { tabId, rect: at } : null;
  });
  if (read.some((chip) => chip === null)) return null;
  return { zoom, rect: strip, chips: read as MeasuredStrip["chips"], gap, start };
}

/** Window `id`'s strip on the screen, from its content bounds and what its page measured. */
export function placeStrip(id: string, content: FlightRect, measured: MeasuredStrip): StripPlace {
  const { zoom } = measured;
  const onScreen = (rect: PageRect): FlightRect => ({
    x: content.x + rect.left * zoom,
    y: content.y + rect.top * zoom,
    width: rect.width * zoom,
    height: rect.height * zoom,
  });
  return {
    id,
    frame: content,
    strip: {
      rect: onScreen(measured.rect),
      chips: measured.chips.map((chip) => ({ tabId: chip.tabId, rect: onScreen(chip.rect) })),
      gap: measured.gap * zoom,
      start: content.x + measured.start * zoom,
    },
  };
}
