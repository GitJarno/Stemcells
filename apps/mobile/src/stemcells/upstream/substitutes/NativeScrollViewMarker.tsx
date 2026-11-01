// Replaces `native/NativeScrollViewMarker.tsx` (`substitutes.cjs`): inside the home a scroll view
// draws no band under the header (iOS 27's `automatic` edge is a hard band). Where we take the
// band away (the home, a chat's feed), the page blurs at the edges (`edge/Veil.ios.tsx`): under
// the header, and on the home over the tab bar.
import { cloneElement, isValidElement, use, useMemo, type ComponentProps, type Ref } from "react";
import type { ScrollViewInstance, ScrollViewProps } from "react-native";
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

/** The scroll views put to their rest once, as each mounts. */
const rested = new WeakSet<ScrollViewInstance>();

/** A ref that hands the scroll view on to its own, and scrolls it to `top` as it mounts. */
function restsOnMount(own: Ref<ScrollViewInstance> | undefined, top: number) {
  return (node: ScrollViewInstance | null) => {
    if (typeof own === "function") own(node);
    else if (own) own.current = node;
    if (node === null || rested.has(node)) return;
    rested.add(node);
    node.scrollTo({ y: -top, animated: false });
  };
}

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
  const child = isValidElement<ScrollViewProps & { readonly ref?: Ref<ScrollViewInstance> }>(
    props.children,
  )
    ? props.children
    : null;
  // A segment's list opens at its rest, Aski under the header, at minus the safe area. T3's scroll
  // there runs after the first frame, which UIKit's `automatic` inset draws a header lower: Aski
  // dropped and came back up on a switch. Queued as the list mounts, the scroll lands with it.
  const own = child?.props.ref;
  const restOnMount = useMemo(() => restsOnMount(own, insets.top), [own, insets.top]);
  // React Native stops a scroll at the view's own inset, 0 under UIKit's `automatic` one: T3's
  // list, put back to its rest, stood with Aski under the header (stemcells/tasks/phone-home-still.md).
  const children =
    noBand && child !== null
      ? cloneElement(child, {
          scrollToOverflowEnabled: true,
          ...(home !== null && child.props.contentInsetAdjustmentBehavior === "automatic"
            ? { ref: restOnMount }
            : {}),
        })
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
