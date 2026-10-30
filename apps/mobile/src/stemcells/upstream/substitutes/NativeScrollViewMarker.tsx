// Replaces `native/NativeScrollViewMarker.tsx` (`substitutes.cjs`): inside the home a scroll view
// draws no band under the header (iOS 27's `automatic` edge is a hard band). Where we take the
// band away (the home, a chat's feed), the page blurs at the edges (`edge/Veil.ios.tsx`): under
// the header, and on the home over the tab bar.
import { cloneElement, isValidElement, use, type ComponentProps } from "react";
import type { ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Upstream from "../../../native/NativeScrollViewMarker";
import { blurs, Veil } from "../../edge/Veil";
import { AtNight } from "../../home/Night";
import { skyAt } from "../../home/sky";
import { HomeTabsContext, NoHeaderBand } from "../../home/state";
import { useNight } from "../../home/useNight";
import { NativePrimaryColumnContext, NO_HEADER_BAND } from "../home";

export * from "../../../native/NativeScrollViewMarker";

/** Past the status bar: the header's bar, and a short reach under it. */
const HEADER_FADE = 76;
/** What fades over the tab bar, past the home indicator. */
const TAB_BAR_FADE = 72;

export function NativeScrollViewMarker(
  props: ComponentProps<typeof Upstream.NativeScrollViewMarker>,
) {
  const noBand = use(NoHeaderBand);
  const fromScreen = use(Upstream.NativeScrollEdgeEffectsContext);
  const home = use(HomeTabsContext);
  const dusk = useNight(home === null ? null : home.night);
  const primaryColumn = use(NativePrimaryColumnContext);
  const insets = useSafeAreaInsets();
  const ground = useResolveClassNames(primaryColumn ? "bg-drawer" : "bg-screen").backgroundColor;
  const effects = noBand ? NO_HEADER_BAND : (props.scrollEdgeEffects ?? fromScreen);
  // React Native stops a scroll at the view's own inset, 0 under UIKit's `automatic` one: T3's
  // list, put back to its rest, stood with Aski under the header (stemcells/tasks/phone-home-still.md).
  const children =
    noBand && isValidElement<ScrollViewProps>(props.children)
      ? cloneElement(props.children, { scrollToOverflowEnabled: true })
      : props.children;
  const marker = (
    <Upstream.NativeScrollViewMarker {...props} scrollEdgeEffects={effects}>
      {children}
    </Upstream.NativeScrollViewMarker>
  );
  // By value: a screen's options reach here cloned. Upstream never hides the top edge; we do.
  if (effects?.top !== "hidden" || primaryColumn) return marker;
  return (
    <>
      {marker}
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
      {noBand ? (
        <Veil edge="bottom" color={ground} solid={insets.bottom} fade={TAB_BAR_FADE} />
      ) : null}
    </>
  );
}
