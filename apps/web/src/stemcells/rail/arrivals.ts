/**
 * The Mac's arrivals of Aski's planned rows (`stemcells/aski/arrivals.ts`): each lands at the top
 * of Awake, under the pins, as Aski's copy lands there (`aski/throw.ts`), and forms where it
 * landed (`Planned.tsx`). Under Reduce Motion, or with the window hidden, it only fades in.
 */
import { useSyncExternalStore } from "react";

import { type Arrival, createArrivals } from "../../../../../stemcells/aski/arrivals.ts";
import { plannedRows, subscribePlannedRows } from "../../../../../stemcells/aski/planned.ts";
import { playThrow, readyThrow, takeThrow, type ThrowFrom } from "../aski/throw.ts";
import { formAt } from "../cell/forming.ts";
import { reducedMotion, timed, timing } from "../tokens/motion.ts";
import { type Box, GLYPHS } from "../words/spawn/plan.ts";

export type { Arrival } from "../../../../../stemcells/aski/arrivals.ts";

/** In the viewport, on a page on stage. */
function boxOnScreen(element: Element): Box | null {
  const box = element.getBoundingClientRect();
  const shown =
    box.width > 0 &&
    box.right > 0 &&
    box.bottom > 0 &&
    box.left < window.innerWidth &&
    box.top < window.innerHeight &&
    element.closest("[inert]") === null;
  return shown ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
}

/**
 * Where the next row's Cell lands in Awake: the box of the first Cell under the pins, which the
 * new row takes as it pushes that one down; under the last pin when only pins stand; at the top
 * of the empty list otherwise.
 */
function topSlot(): Box | null {
  const awake = document.querySelector('[data-cells-arrive="awake"]');
  if (awake === null) return null;
  const cells = [...awake.querySelectorAll("[data-cells-thread]:not([data-leaving])")];
  const first = cells.find((row) => !row.hasAttribute("data-pinned"));
  const cell = (first ?? cells.at(-1))?.querySelector("[data-cells-row-cell]");
  if (cell) {
    const box = boxOnScreen(cell);
    if (box === null || first !== undefined) return box;
    const row = cells.at(-1)!.getBoundingClientRect();
    return { ...box, y: box.y + row.height };
  }
  const box = boxOnScreen(awake);
  if (box === null) return null;
  // An empty list: where its first row's Cell will stand (cells.css: the rows' and a row's padding, a line's height).
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return { x: box.x + 14, y: box.y + 0.4375 * rem + (1.25 * rem - 14) / 2, width: 13, height: 14 };
}

const arrivals = createArrivals<ThrowFrom, Box>(plannedRows, {
  now: () => performance.now(),
  reduced: () => reducedMotion() || (typeof document !== "undefined" && document.hidden),
  travel: () => timed("travel").duration,
  takeThrow,
  slot: topSlot,
  ready: readyThrow,
  playThrow: (from, to) => void playThrow(from, to),
  // Its box is the glyphs' until they have condensed; then the Cell's blocks, or its outline.
  forms: (threadId, at) => formAt(threadId, at + GLYPHS.length * timing("formStep")),
  fills: formAt,
});
subscribePlannedRows(arrivals.sync);

/** Whether a row landing in Awake now would be seen: the list on screen, on its stage. */
export const awakeInSight = (): boolean => topSlot() !== null;

/** The planned rows standing in Awake, in the order they landed. */
export function useArrivals(): readonly Arrival[] {
  return useSyncExternalStore(arrivals.subscribe, arrivals.read, arrivals.read);
}

/** The machine lists these Cells now (`createArrivals`, `listed`). */
export const cellsListed = arrivals.listed;
