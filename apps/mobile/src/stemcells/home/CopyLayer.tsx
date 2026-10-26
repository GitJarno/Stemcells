// The copies of Aski in flight over the home (`copies.ts`): each buds off
// Aski at half its height, flies along a bow to its Cell's card, shrinking
// to the Cell's size, and fades as it lands and the Cell's glyphs start. A
// layer over the list that no touch meets.

import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { VIEW } from "../aski/drawing";
import { clockSeconds } from "../cell/kit";
import { copyLanded, type Flight, useCopies } from "./copies";

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
  // oxlint-disable-next-line t3code/react-effect-budget -- Start the copy's flight toward its landing time and report it landed when the timing finishes.
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
    const height = from.height + (to.height - from.height) * p;
    return {
      opacity: p < 0.8 ? 1 : (1 - p) / 0.2,
      transform: [
        { translateX: from.x + (to.x - from.x) * p - WIDTH / 2 },
        { translateY: from.y + (to.y - from.y) * p - bow * Math.sin(Math.PI * p) - HEIGHT / 2 },
        { scale: height / HEIGHT },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0 }, style]}>
      <AskiFigure height={HEIGHT} ink={ink} ground={ground} />
    </Animated.View>
  );
}

export function CopyLayer() {
  const copies = useCopies();
  const layer = useRef<ViewInstance>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  return (
    <View
      ref={layer}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={() => layer.current?.measureInWindow((x, y) => setOrigin({ x, y }))}
    >
      {copies.map((flight) => (
        <Copy key={flight.threadId} flight={flight} origin={origin} />
      ))}
    </View>
  );
}
