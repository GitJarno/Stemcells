import { expect, it } from "vite-plus/test";

import type { NativeLayoutMetrics } from "../upstream/reservedRegions";
import { titleRowWidth } from "./header";

// The unfolded Duo in portrait, as upstream's tests have it: the status block holds the top
// band's right end, and the bar's buttons stand beside it.
const unfolded: NativeLayoutMetrics = {
  width: 669,
  height: 951,
  hasHinge: true,
  horizontalSizeClass: "regular",
  verticalBarEdge: "none",
  safeArea: { top: 82, bottom: 34, left: 0, right: 0 },
  reservedRegions: [{ kind: "occlusion", x: 535, y: 0, width: 134, height: 82 }],
};

it.each([
  ["beside the Duo's status block", unfolded, 535],
  ["under a notch or an island", { ...unfolded, reservedRegions: [] }, 669],
  ["before the column has measured", null, null],
] as const)("gives the title row its width %s", (_, metrics, expected) => {
  expect(titleRowWidth(metrics)).toBe(expected);
});
