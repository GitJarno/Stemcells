// What flies over the home: Aski's copies (`copies.ts`), budding off Aski and shrinking along a bow
// to their Cells' cards, and slept or woken Cells on their way to their stage (`Hop.tsx`). A layer
// over the window that no touch meets, so a copy from Aski's chat crosses to the home beside it;
// there only while one flies.

import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View, type ViewInstance } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { FullWindowOverlay } from "react-native-screens";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { VIEW } from "../aski/drawing";
import { clockSeconds } from "../cell/kit";
import { copyLanded, type Flight, useCopies } from "./copies";
import { alongBow } from "./flight";
import { HopFlight } from "./Hop";
import { type Hop, useHops } from "./hops";

/** A copy's own height, points; it is scaled from there. */
const HEIGHT = 48;
const WIDTH = (VIEW.width / VIEW.height) * HEIGHT;
/** How far its way bows up, of its length. */
const BOW = 0.18;

function Copy(props: { readonly flight: Flight; readonly origin: { x: number; y: number } }) {
  const { flight, origin } = props;
  const ink = useResolveClassNames("text-foreground").color;
  const ground = useResolveClassNames("bg-screen").backgroundColor;
  const progress = useSharedValue(0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Start the copy's flight toward its landing time and report it landed when the timing finishes.
  useEffect(() => {
    const duration = Math.max(150, (flight.lands - clockSeconds()) * 1000);
    progress.set(
      withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(copyLanded)(flight.threadId);
      }),
    );
  }, [flight, progress]);
  const from = {
    x: flight.from.x + flight.from.width / 2 - origin.x,
    y: flight.from.y + flight.from.height / 2 - origin.y,
    height: flight.from.height / 2,
  };
  const to = {
    x: flight.to.x + flight.to.width / 2 - origin.x,
    y: flight.to.y + flight.to.height / 2 - origin.y,
    height: flight.to.height,
  };
  const bow = Math.hypot(to.x - from.x, to.y - from.y) * BOW;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const at = alongBow(from, to, bow, p);
    return {
      opacity: p < 0.8 ? 1 : (1 - p) / 0.2,
      transform: [
        { translateX: at.x - WIDTH / 2 },
        { translateY: at.y - HEIGHT / 2 },
        { scale: at.height / HEIGHT },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0 }, style]}>
      <AskiFigure height={HEIGHT} ink={ink} ground={ground} />
    </Animated.View>
  );
}

/** `shown` while the home is on screen: a copy still in flight as a chat covers it flies on unseen. */
export function CopyLayer(props: { readonly shown: boolean }) {
  const copies = useCopies();
  const hops = useHops();
  if (copies.length === 0 && hops.length === 0) return null;
  const flying = <Flying copies={copies} hops={hops} shown={props.shown} />;
  // iOS: over both columns and the bars, where the window's points are the layer's own.
  return Platform.OS === "ios" ? <FullWindowOverlay>{flying}</FullWindowOverlay> : flying;
}

function Flying(props: {
  readonly copies: readonly Flight[];
  readonly hops: readonly Hop[];
  readonly shown: boolean;
}) {
  const layer = useRef<ViewInstance>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  return (
    <View
      ref={layer}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, props.shown ? null : { opacity: 0 }]}
      onLayout={() => layer.current?.measureInWindow((x, y) => setOrigin({ x, y }))}
    >
      {props.copies.map((flight) => (
        <Copy key={flight.threadId} flight={flight} origin={origin} />
      ))}
      {props.hops.map((hop) => (
        <HopFlight key={hop.key} hop={hop} origin={origin} />
      ))}
    </View>
  );
}
