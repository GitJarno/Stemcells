// Replaces `native/NativeScrollViewMarker.tsx` (`substitutes.cjs`): inside the home a scroll view
// draws no band under the header (iOS 27's `automatic` edge is a hard band); the page blurs at
// the edges instead (`edge/ScreenVeils.tsx`). A stage's list on the home's tabs hands its scroll
// to its stage (`home/StagePages.tsx`), which draws the veils once over them all.
import { cloneElement, isValidElement, use, type ComponentProps, type Ref } from "react";
import type { ScrollViewInstance, ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Upstream from "../../../native/NativeScrollViewMarker";
import { ScreenVeils } from "../../edge/ScreenVeils";
import { useStageScrollView } from "../../home/StagePages";
import { NoHeaderBand, StagePageContext } from "../../home/state";
import { NativePrimaryColumnContext, NO_HEADER_BAND } from "../home";

export * from "../../../native/NativeScrollViewMarker";

export function NativeScrollViewMarker(
  props: ComponentProps<typeof Upstream.NativeScrollViewMarker>,
) {
  const noBand = use(NoHeaderBand);
  const fromScreen = use(Upstream.NativeScrollEdgeEffectsContext);
  const page = use(StagePageContext);
  const primaryColumn = use(NativePrimaryColumnContext);
  const insets = useSafeAreaInsets();
  const effects = noBand ? NO_HEADER_BAND : (props.scrollEdgeEffects ?? fromScreen);
  const child = isValidElement<ScrollViewProps & { readonly ref?: Ref<ScrollViewInstance> }>(
    props.children,
  )
    ? props.children
    : null;
  // T3's list rests at minus the safe area under UIKit's `automatic` inset; ours at 0.
  const rest = child?.props.contentInsetAdjustmentBehavior === "automatic" ? -insets.top : 0;
  const ref = useStageScrollView(page, rest, child?.props.ref);
  // React Native stops a scroll at the view's own inset, 0 under UIKit's `automatic` one: T3's
  // list, put back to its rest, stood with Aski under the header (stemcells/tasks/phone-home-still.md).
  const children =
    noBand && child !== null
      ? cloneElement(child, {
          scrollToOverflowEnabled: true,
          ...(page === null
            ? {}
            : {
                ref,
                scrollsToTop: page.active,
                contentContainerStyle: [
                  child.props.contentContainerStyle,
                  { minHeight: page.minHeight + rest },
                ],
              }),
        })
      : props.children;
  const marker = (
    <Upstream.NativeScrollViewMarker {...props} scrollEdgeEffects={effects}>
      {children}
    </Upstream.NativeScrollViewMarker>
  );
  // By value: a screen's options reach here cloned. Upstream never hides the top edge; we do.
  if (page !== null || effects?.top !== "hidden" || primaryColumn) return marker;
  return (
    <>
      {marker}
      <ScreenVeils night={null} bottom={noBand} />
    </>
  );
}
