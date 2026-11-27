// A slept or woken Cell over the home (`hops.ts`): it waits where its row let it go until the line
// says where it went. A woken Cell opens its eyes and flies a low bow on the lists' move; a slept
// one leaps (`leapOf`), its eyes closing past the top, and falls into Asleep's count, which
// catches it. Both shrink to the segment's words.

import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { ThreadCell } from "../cell/ThreadCell";
import { leapFrames, leapOf } from "../line/kit";
import { alongBow, type LeapFrames, poseAt } from "./flight";
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

interface LeapPlan extends LeapFrames {
  readonly launch: number;
  readonly eyes: number;
}

function landed(key: string) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  hopLanded(key);
}

function tookOff() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function caught(key: string) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  hopLanded(key);
}

/** A box's middle, in the layer at `origin`. */
const middleOf = (box: Hop["from"], origin: { x: number; y: number }, height = box.height) => ({
  x: box.x + box.width / 2 - origin.x,
  y: box.y + box.height / 2 - origin.y,
  height,
});

export function HopFlight(props: { readonly hop: Hop; readonly origin: { x: number; y: number } }) {
  const { hop, origin } = props;
  const progress = useSharedValue(0);
  const clock = useSharedValue(0);
  const leap = useSharedValue<LeapPlan | null>(null);
  const shown = useSharedValue(1);
  const [eyesShut, setEyesShut] = useState(false);
  const { key, to, fades } = hop;
  const sleeps = hop.toStage === "asleep";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fly or leap once the segment it goes to is measured, and report the landing.
  useEffect(() => {
    if (to === null) return;
    if (!sleeps) {
      progress.set(
        withDelay(
          EYES_MS,
          withTiming(1, MOVE, (finished) => {
            if (finished) runOnJS(landed)(key);
          }),
        ),
      );
      return;
    }
    const zero = { x: 0, y: 0 };
    const plan = leapOf(middleOf(hop.from, zero), middleOf(to, zero, LANDING_HEIGHT));
    leap.set({ ...leapFrames(plan), launch: plan.launch, eyes: plan.eyes });
    // Linear: the leap's poses carry its gravity.
    clock.set(
      withTiming(plan.total, { duration: plan.total, easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(caught)(key);
      }),
    );
  }, [key, to, sleeps, hop.from, progress, clock, leap]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fade where it waits when its move went nowhere, and report it gone.
  useEffect(() => {
    if (!fades) return;
    shown.set(
      withTiming(0, ENTER, (finished) => {
        if (finished) runOnJS(hopFaded)(key);
      }),
    );
  }, [key, fades, shown]);
  // Its feet leave the ground, then its eyes close past the top.
  useAnimatedReaction(
    () => {
      const plan = leap.get();
      if (plan === null) return 0;
      const ms = clock.get();
      return ms >= plan.eyes ? 2 : ms >= plan.launch ? 1 : 0;
    },
    (phase, before) => {
      const was = before ?? 0;
      if (phase >= 1 && was < 1) runOnJS(tookOff)();
      if (phase === 2 && was < 2) runOnJS(setEyesShut)(true);
    },
  );
  const { width, height } = hop.from;
  const from = middleOf(hop.from, origin);
  const target = to === null ? from : middleOf(to, origin, LANDING_HEIGHT);
  const bow = Math.hypot(target.x - from.x, target.y - from.y) * BOW;
  const style = useAnimatedStyle(() => {
    const plan = leap.get();
    if (plan !== null) {
      const pose = poseAt(plan, clock.get());
      return {
        opacity: shown.get() * pose.opacity,
        transform: [
          { translateX: pose.x - origin.x - width / 2 },
          { translateY: pose.y - origin.y - height / 2 },
          { rotate: `${pose.rotate}deg` },
          { scaleX: pose.scaleX },
          { scaleY: pose.scaleY },
        ],
      };
    }
    const p = progress.get();
    const at = alongBow(from, target, bow, p);
    const scale = at.height / height;
    return {
      opacity: shown.get() * (p < INTO_COUNT ? 1 : (1 - p) / (1 - INTO_COUNT)),
      transform: [
        { translateX: at.x - width / 2 },
        { translateY: at.y - height / 2 },
        { rotate: "0deg" },
        { scaleX: scale },
        { scaleY: scale },
      ],
    };
  });
  const asleep = sleeps ? eyesShut : (hop.toStage ?? hop.fromStage) === "asleep";
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width, height }, style]}>
      <ThreadCell thread={hop.thread} points={2} away={asleep} held />
    </Animated.View>
  );
}
