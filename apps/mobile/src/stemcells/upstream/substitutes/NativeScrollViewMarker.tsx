// Replaces `native/NativeScrollViewMarker.tsx` (`substitutes.cjs`): inside the home, in a chat,
// and on every page of the Duo's columns, a scroll view draws no band under the header
// (`edge/headerEdge.ts`); the page blurs at the edges instead (`edge/ScreenVeils.tsx`). A stage's
// list on the home's tabs hands its scroll to its stage (`home/StagePages.tsx`), which draws the veils once over them all.
import { cloneElement, isValidElement, use, type ComponentProps, type Ref } from "react";
import { type ScrollViewInstance, type ScrollViewProps, StyleSheet } from "react-native";

import { PaneContext } from "../../../components/ui/Pane";
import { useBarInset } from "../../../components/ui/useBarInset";
import { isDuoDevice } from "../../../lib/device-type";
import * as Upstream from "../../../native/NativeScrollViewMarker";
import { useDeviceType } from "../../../native/native-layout-metrics";
import { headerEdges } from "../../edge/headerEdge";
import { ScreenVeils } from "../../edge/ScreenVeils";
import { useStageScrollView } from "../../home/StagePages";
import { NoHeaderBand, StagePageContext, useFootRoom } from "../../home/state";
import { NativePrimaryColumnContext } from "../home";

export * from "../../../native/NativeScrollViewMarker";

export function NativeScrollViewMarker(
  props: ComponentProps<typeof Upstream.NativeScrollViewMarker>,
) {
  const noBand = use(NoHeaderBand);
  const fromScreen = use(Upstream.NativeScrollEdgeEffectsContext);
  const page = use(StagePageContext);
  const primaryColumn = use(NativePrimaryColumnContext);
  // A page in the Duo's columns, not a sheet or the inspector over them.
  const duoPage = isDuoDevice(useDeviceType()) && use(PaneContext) === "content";
  const barBottom = useBarInset();
  const effects = headerEdges({
    home: noBand,
    duoPage,
    asked: props.scrollEdgeEffects ?? fromScreen,
  });
  const child = isValidElement<ScrollViewProps & { readonly ref?: Ref<ScrollViewInstance> }>(
    props.children,
  )
    ? props.children
    : null;
  const ref = useStageScrollView(page, child?.props.ref);
  const footRoom = useFootRoom();
  const ownPadding = StyleSheet.flatten(child?.props.contentContainerStyle)?.paddingBottom;
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
                // One inset on every stage's scroll view, by hand as T3's list sets its own, so one
                // offset means one place. UIKit's `automatic` would add its own on top of a list's.
                contentInsetAdjustmentBehavior: "never",
                contentInset: { ...child.props.contentInset, top: page.inset },
                contentContainerStyle: [
                  child.props.contentContainerStyle,
                  { minHeight: page.minHeight },
                  footRoom > 0 && typeof (ownPadding ?? 0) === "number"
                    ? { paddingBottom: Number(ownPadding ?? 0) + footRoom }
                    : null,
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
      <ScreenVeils night={null} bottom={noBand} barBottom={barBottom} />
    </>
  );
}
