// A slept or woken Cell over the home (`hops.ts`), its row's leave: it waits where its row let it
// go, its eyes as they were; once the line says where it went its eyes close (or open) and it
// moves on the lists' move, along a low bow, to that stage's segment, shrinking to the segment's
// words, and the count takes it.

import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { ThreadCell } from "../cell/ThreadCell";
import { alongBow } from "./flight";
import { type Hop, hopFaded, hopLanded } from "./hops";
import { ENTER, MOVE } from "./listMotion";

/** How far its way bows up, of its length: lower than a copy of Aski's. */
const BOW = 0.1;
/** A beat for its eyes before it leaves. */
const EYES_MS = 90;
/** The segment's words' height, points: it lands that small. */
const LANDING_HEIGHT = 13;
/** Where it starts to go into the count, of its way. */
const INTO_COUNT = 0.85;

function landed(key: string) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  hopLanded(key);
}

export function HopFlight(props: { readonly hop: Hop; readonly origin: { x: number; y: number } }) {
  const { hop, origin } = props;
  const progress = useSharedValue(0);
  const shown = useSharedValue(1);
  const { key, to, fades } = hop;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fly once the segment it goes to is measured, and report the landing.
  useEffect(() => {
    if (to === null) return;
    progress.set(
      withDelay(
        EYES_MS,
        withTiming(1, MOVE, (finished) => {
          if (finished) runOnJS(landed)(key);
        }),
      ),
    );
  }, [key, to, progress]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fade where it waits when its move went nowhere, and report it gone.
  useEffect(() => {
    if (!fades) return;
    shown.set(
      withTiming(0, ENTER, (finished) => {
        if (finished) runOnJS(hopFaded)(key);
      }),
    );
  }, [key, fades, shown]);
  const { width, height } = hop.from;
  const from = {
    x: hop.from.x + width / 2 - origin.x,
    y: hop.from.y + height / 2 - origin.y,
    height,
  };
  const target =
    to === null
      ? from
      : {
          x: to.x + to.width / 2 - origin.x,
          y: to.y + to.height / 2 - origin.y,
          height: LANDING_HEIGHT,
        };
  const bow = Math.hypot(target.x - from.x, target.y - from.y) * BOW;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const at = alongBow(from, target, bow, p);
    return {
      opacity: shown.get() * (p < INTO_COUNT ? 1 : (1 - p) / (1 - INTO_COUNT)),
      transform: [
        { translateX: at.x - width / 2 },
        { translateY: at.y - height / 2 },
        { scale: at.height / height },
      ],
    };
  });
  const asleep = (hop.toStage ?? hop.fromStage) === "asleep";
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width, height }, style]}>
      <ThreadCell thread={hop.thread} points={2} away={asleep} held />
    </Animated.View>
  );
}
