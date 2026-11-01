// The veils over a screen whose scroll view draws no band under the header
// (`upstream/substitutes/NativeScrollViewMarker.tsx`): the page blurs under the header, and on
// the home over the tab bar. The home draws them once over its stages' lists and Aski
// (`home/StagePages.tsx`), so Aski scrolls under the header's veil as a list's rows do.

import { use } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { AtNight } from "../home/Night";
import { skyAt } from "../home/sky";
import { useNight } from "../home/useNight";
import { NativePrimaryColumnContext } from "../upstream/home";
import { blurs, Veil } from "./Veil";

/** Past the status bar: the header's bar, and a short reach under it. */
const HEADER_FADE = 76;
/** What fades over the tab bar, past the home indicator. */
const TAB_BAR_FADE = 72;

export function ScreenVeils(props: {
  /** Whether night stands over the home's header; null off the home. */
  readonly night: boolean | null;
  /** The tab bar's veil too: the home's. */
  readonly bottom: boolean;
}) {
  const dusk = useNight(props.night);
  const primaryColumn = use(NativePrimaryColumnContext);
  const insets = useSafeAreaInsets();
  const ground = useResolveClassNames(primaryColumn ? "bg-drawer" : "bg-screen").backgroundColor;
  return (
    <>
      <Veil
        edge="top"
        color={dusk === "night" ? skyAt(0) : ground}
        solid={insets.top}
        fade={HEADER_FADE}
      />
      {dusk === "turning" && !blurs ? (
        <AtNight
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: insets.top + HEADER_FADE,
          }}
        >
          <Veil edge="top" color={skyAt(0)} solid={insets.top} fade={HEADER_FADE} />
        </AtNight>
      ) : null}
      {props.bottom ? (
        <Veil edge="bottom" color={ground} solid={insets.bottom} fade={TAB_BAR_FADE} />
      ) : null}
    </>
  );
}
