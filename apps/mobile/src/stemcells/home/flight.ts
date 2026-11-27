// Where something flying over the home stands: Aski's copies (`copies.ts`) and a woken Cell
// (`hops.ts`) take the same bow; a slept Cell leaps (`leapOf`, the Mac's own). Boxes are window
// points.

import type { LeapPose } from "../line/kit";
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

/** A leap's poses at even steps of `step` ms (`leapFrames`), carried to the UI thread whole. */
export interface LeapFrames {
  readonly step: number;
  readonly poses: readonly LeapPose[];
}

/** Where a leap stands `ms` after its crouch began, between its two nearest poses. */
export function poseAt({ step, poses }: LeapFrames, ms: number): LeapPose {
  "worklet";
  const at = Math.min(Math.max(ms / step, 0), poses.length - 1);
  const i = Math.min(Math.floor(at), poses.length - 2);
  const k = at - i;
  const a = poses[i]!;
  const b = poses[i + 1]!;
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    scaleX: a.scaleX + (b.scaleX - a.scaleX) * k,
    scaleY: a.scaleY + (b.scaleY - a.scaleY) * k,
    rotate: a.rotate + (b.rotate - a.rotate) * k,
    opacity: a.opacity + (b.opacity - a.opacity) * k,
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
