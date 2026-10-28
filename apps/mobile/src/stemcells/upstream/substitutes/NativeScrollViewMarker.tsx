// Replaces `native/NativeScrollViewMarker.tsx` (`substitutes.cjs`): inside the home
// (`home/HomeFront.tsx`) a scroll view draws no band under the header. UIKit draws the edge on
// the scroll view, and T3's home list asks for iOS 27's `automatic` one, a hard band.
import { use, type ComponentProps } from "react";

import * as Upstream from "../../../native/NativeScrollViewMarker";
import { NoHeaderBand } from "../../home/state";
import { NO_HEADER_BAND } from "../home";

export * from "../../../native/NativeScrollViewMarker";

export function NativeScrollViewMarker(
  props: ComponentProps<typeof Upstream.NativeScrollViewMarker>,
) {
  const noBand = use(NoHeaderBand);
  return (
    <Upstream.NativeScrollViewMarker
      {...props}
      scrollEdgeEffects={noBand ? NO_HEADER_BAND : props.scrollEdgeEffects}
    />
  );
}
