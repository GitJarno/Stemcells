// A Flying card's light (`Wave.tsx`): the wash from the card's Cell, on the home's Flying tab only.

import { use } from "react";
import { useResolveClassNames } from "uniwind";

import { useDriverOf } from "../cell/ThreadCell";
import { HomeInFront, HomeTabsContext } from "../home/state";
import { TONES } from "../tokens";
import type { EnvironmentThreadShell } from "../upstream/cells";
import { rgbOf } from "./colour";
import { toneTokenOf } from "./kit";
import { Wave } from "./Wave";

/**
 * The card's content padding, the row's `pl-3 pr-4 py-3`
 * (`upstream/substitutes/thread-list-v2-row-appearance.ts`): the light fills the card from inside it.
 */
const CARD_PADDING = { top: 12, right: 16, bottom: 12, left: 12 } as const;
/** The Cell's middle across the card: its column is 52 points wide, inside the card's padding. */
const CELL_MIDDLE = CARD_PADDING.left + 26;
const FILL = {
  position: "absolute",
  top: -CARD_PADDING.top,
  right: -CARD_PADDING.right,
  bottom: -CARD_PADDING.bottom,
  left: -CARD_PADDING.left,
} as const;

/** The card's light, on the home's Flying tab only; anywhere else, nothing. */
export function CardLight(props: { readonly thread: EnvironmentThreadShell }) {
  const flying = use(HomeTabsContext)?.tab === "working";
  return flying ? <Light thread={props.thread} /> : null;
}

function Light(props: { readonly thread: EnvironmentThreadShell }) {
  const inFront = use(HomeInFront);
  const tone = rgbOf(TONES[toneTokenOf(useDriverOf(props.thread))] ?? TONES["--sc-accent"])!;
  const glass = rgbOf(useResolveClassNames("bg-grouped-card").backgroundColor) ?? [0, 0, 0];
  const ink = rgbOf(useResolveClassNames("text-foreground").color) ?? [255, 255, 255];
  return (
    <Wave tone={tone} glass={glass} ink={ink} anchorX={CELL_MIDDLE} fill={FILL} inSight={inFront} />
  );
}
