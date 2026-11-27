// Replaces `native/NativeScrollViewMarker.tsx` (`substitutes.cjs`): inside the home, in a chat,
// and on every page of the Duo's columns, a scroll view draws no band under the header
// (`edge/headerEdge.ts`); the page blurs at the edges instead (`edge/ScreenVeils.tsx`). A stage's
// list rests under one inset and scrolls clear of the stages' pill (`home/StagePages.tsx`).
import { cloneElement, isValidElement, use, type ComponentProps } from "react";
import { type ScrollViewProps, StyleSheet } from "react-native";

import { PaneContext } from "../../../components/ui/Pane";
import { useBarInset } from "../../../components/ui/useBarInset";
import { isDuoDevice } from "../../../lib/device-type";
import * as Upstream from "../../../native/NativeScrollViewMarker";
import { useDeviceType } from "../../../native/native-layout-metrics";
import { headerEdges } from "../../edge/headerEdge";
import { ScreenVeils } from "../../edge/ScreenVeils";
import { NoHeaderBand, PILL_ROOM, StagePageContext, useFootRoom } from "../../home/state";
import { useHomeSidebar } from "../home";

export * from "../../../native/NativeScrollViewMarker";

export function NativeScrollViewMarker(
  props: ComponentProps<typeof Upstream.NativeScrollViewMarker>,
) {
  const noBand = use(NoHeaderBand);
  const fromScreen = use(Upstream.NativeScrollEdgeEffectsContext);
  const page = use(StagePageContext);
  const sidebar = useHomeSidebar();
  // A page in the Duo's columns, not a sheet or the inspector over them.
  const duoPage = isDuoDevice(useDeviceType()) && use(PaneContext) === "content";
  const barBottom = useBarInset();
  const effects = headerEdges({
    home: noBand,
    duoPage,
    asked: props.scrollEdgeEffects ?? fromScreen,
  });
  const child = isValidElement<ScrollViewProps>(props.children) ? props.children : null;
  const footRoom = useFootRoom() + PILL_ROOM;
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
                scrollsToTop: page.active,
                // One inset on every stage's scroll view, by hand as T3's list sets its own, so one
                // offset means one place. UIKit's `automatic` would add its own on top of a list's.
                contentInsetAdjustmentBehavior: "never",
                contentInset: { ...child.props.contentInset, top: page.inset },
                // T3's list opens at its own rest; a page of ours opens at the same.
                contentOffset: child.props.contentOffset ?? { x: 0, y: -page.inset },
                contentContainerStyle: [
                  child.props.contentContainerStyle,
                  typeof (ownPadding ?? 0) === "number"
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
  if (page !== null || effects?.top !== "hidden" || sidebar) return marker;
  return (
    <>
      {marker}
      <ScreenVeils night={null} bottom={noBand} barBottom={barBottom} />
    </>
  );
}
