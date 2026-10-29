// Replaces `native/NativeScrollViewMarker.tsx` (`substitutes.cjs`): inside the home a scroll view
// draws no band under the header (iOS 27's `automatic` edge is a hard band). Where we take the
// band away (the home, a chat's feed), the page blurs at the edges (`edge/Veil.ios.tsx`): under
// the header, and on the home over the tab bar.
import { use, type ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Upstream from "../../../native/NativeScrollViewMarker";
import { Veil } from "../../edge/Veil";
import { skyAt } from "../../home/sky";
import { HomeTabsContext, NoHeaderBand } from "../../home/state";
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
  const night = use(HomeTabsContext)?.night === true;
  const primaryColumn = use(NativePrimaryColumnContext);
  const insets = useSafeAreaInsets();
  const ground = useResolveClassNames(primaryColumn ? "bg-drawer" : "bg-screen").backgroundColor;
  const effects = noBand ? NO_HEADER_BAND : (props.scrollEdgeEffects ?? fromScreen);
  const marker = <Upstream.NativeScrollViewMarker {...props} scrollEdgeEffects={effects} />;
  // By value: a screen's options reach here cloned. Upstream never hides the top edge; we do.
  if (effects?.top !== "hidden" || primaryColumn) return marker;
  return (
    <>
      {marker}
      <Veil edge="top" color={night ? skyAt(0) : ground} solid={insets.top} fade={HEADER_FADE} />
      {noBand ? (
        <Veil edge="bottom" color={ground} solid={insets.bottom} fade={TAB_BAR_FADE} />
      ) : null}
    </>
  );
}
