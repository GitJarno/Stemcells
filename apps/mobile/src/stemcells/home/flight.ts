// Where something flying over the home stands: Aski's copies (`copies.ts`) and a slept or woken
// Cell (`hops.ts`) take the same bow. Boxes are window points.

import type { Box } from "./copies";

/** A flight's end: its middle and its height there. */
export interface End {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

/** Where a flight stands at `p` (0 to 1) on its way from `from` to `to`, bowed up by `bow` points. */
export function alongBow(from: End, to: End, bow: number, p: number): End {
  "worklet";
  return {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p - bow * Math.sin(Math.PI * p),
    height: from.height + (to.height - from.height) * p,
  };
}

/** UIKit's segmented control draws its segments this far inside its track. */
const TRACK_INSET = 2;

/** The box of segment `index` of `count` in a segmented control standing in `pill`: equal widths. */
export function segmentOf(pill: Box, index: number, count: number): Box {
  const width = (pill.width - TRACK_INSET * 2) / count;
  return {
    x: pill.x + TRACK_INSET + width * index,
    y: pill.y + TRACK_INSET,
    width,
    height: pill.height - TRACK_INSET * 2,
  };
}
