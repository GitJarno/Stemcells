// A mark's icon, drawn as the app's own icons are: a 24 unit square, a stroke of 2 with round
// caps and joins, no fill. One set of shapes for the Mac and the phone, which draws the same
// parts with its own SVG. Each was proofed from 12 to 48 px on both grounds.

import type { MarkId } from "../../../../../stemcells/ledger/marks.ts";

/** A stroked path, or a stroked circle as `[cx, cy, r]`. */
export type MarkIconPart =
  | { readonly d: string }
  | { readonly circle: readonly [number, number, number] };

export const MARK_ICON_BOX = 24;
export const MARK_ICON_STROKE = 2;

export const MARK_ICONS: Readonly<Record<MarkId, ReadonlyArray<MarkIconPart>>> = {
  // A flight that comes down onto the ground.
  "landed-alone": [
    { d: "M3 21h18" },
    { d: "M4 4h3a10 10 0 0 1 10 10v2.5" },
    { d: "m13 12.5 4 4 4-4" },
  ],
  // Two lines joined into one.
  merged: [
    { circle: [5.5, 6, 2.5] },
    { circle: [5.5, 18, 2.5] },
    { circle: [18.5, 12, 2.5] },
    { d: "M8 6c4.5 0 3.5 6 8 6" },
    { d: "M8 18c4.5 0 3.5-6 8-6" },
  ],
  // A loop in the air, and on it goes.
  "frequent-flyer": [
    { d: "M2 18h3c5.5 0 10-3.5 10-8 0-2.5-1.6-4.5-3.5-4.5S8 7.5 8 10c0 4.5 4.5 8 10 8h3.5" },
    { d: "m18.5 15 3 3-3 3" },
  ],
  // A speech bubble with nothing said in it.
  "radio-silence": [{ d: "M12 3a9 9 0 1 1-4.1 17L3 21l1-4.9A9 9 0 0 1 12 3z" }, { d: "M8.5 12h7" }],
  // A top hat.
  "hat-trick": [
    { d: "M3 16.5c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5" },
    { d: "M7 17V6.5A1.5 1.5 0 0 1 8.5 5h7A1.5 1.5 0 0 1 17 6.5V17" },
    { d: "M7 13h10" },
  ],
  // A stopwatch, well run.
  "long-haul": [{ circle: [12, 14, 7.5] }, { d: "M10 2.5h4" }, { d: "m12 14 3-3.5" }],
};
