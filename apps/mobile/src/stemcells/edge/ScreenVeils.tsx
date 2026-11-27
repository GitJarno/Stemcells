// The veils over a screen whose scroll view draws no band under the header
// (`upstream/substitutes/NativeScrollViewMarker.tsx`): the page blurs under the header, and on
// the home over the tab bar. The home draws them once over its stages' lists
// (`home/StagePages.tsx`), in every posture, the sidebar's too.

import { useState } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { useHomeSidebar } from "../upstream/home";
import { type Resting, restingBar } from "./restingBar";
import { Veil } from "./Veil";

/** Past the status bar: the header's bar, and a short reach under it. */
const HEADER_FADE = 76;
/** How far past a bar's foot the veil reaches: its clear quarter starts about there. */
const PAST_THE_BAR = 32;
/** What fades over the tab bar, past the home indicator. */
const TAB_BAR_FADE = 72;

export function ScreenVeils(props: {
  /** The tab bar's veil too: the home's. */
  readonly bottom: boolean;
  /**
   * Where the header's bar ends, when the page stands under a native bar: the veil reaches a
   * little past it, and rises and returns with the bar as iOS minimizes it. The Duo's bar is
   * taller than the phone's, under no status bar.
   */
  readonly barBottom?: number;
  /** Where chrome under the bar ends, the stages' pill on an upright phone: the veil reaches past it. */
  readonly chromeBottom?: number;
}) {
  const sidebar = useHomeSidebar();
  const insets = useSafeAreaInsets();
  const ground = useResolveClassNames(sidebar ? "bg-drawer" : "bg-screen").backgroundColor;
  const window = useWindowDimensions();
  // Cut to the bar at rest, so the native veil rises and returns with the bar (`restingBar.ts`).
  const [held, setHeld] = useState<Resting | null>(null);
  const resting = props.barBottom === undefined ? null : restingBar(held, window, props.barBottom);
  if (resting !== null && resting !== held) setHeld(resting);
  const headerFade = Math.max(
    resting === null ? HEADER_FADE : Math.max(0, resting.bar + PAST_THE_BAR - insets.top),
    props.chromeBottom === undefined ? 0 : props.chromeBottom + PAST_THE_BAR - insets.top,
  );
  return (
    <>
      <Veil
        edge="top"
        color={ground}
        solid={insets.top}
        fade={headerFade}
        followsBar={props.barBottom !== undefined}
      />
      {props.bottom ? (
        <Veil edge="bottom" color={ground} solid={insets.bottom} fade={TAB_BAR_FADE} />
      ) : null}
    </>
  );
}
