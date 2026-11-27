// A slept or woken Cell over the home (`hops.ts`), waiting where its row let it go until the line
// says where it went. A woken one flies a low bow to its segment's words; a slept one leaps
// (`leapOf`), thrown by the swipe that let it go, onto Asleep's rim, which catches it, and sinks in.

import * as Haptics from "expo-haptics";
import { useEffect, useLayoutEffect, useState } from "react";
import Animated, {
  Easing,
  measure,
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { ThreadCell } from "../cell/ThreadCell";
import { leapFrames, leapOf } from "../line/kit";
import { alongBow, type LeapFrames, poseAt } from "./flight";
import { type Hop, hopCaught, hopFaded, hopLanded } from "./hops";
import { ENTER, MOVE } from "./listMotion";

/** How far its way bows up, of its length: lower than a copy of Aski's. */
const BOW = 0.1;
/** A beat for its eyes before it leaves. */
const EYES_MS = 90;
/** The segment's words' height, points: a woken Cell lands that small. */
const LANDING_HEIGHT = 13;
/** A slept Cell lands this tall, of its own height: still a Cell, small enough for its segment. */
const LANDING = 0.6;
/** Where it starts to go into the count, of its way. */
const INTO_COUNT = 0.85;

interface LeapPlan extends LeapFrames {
  readonly launch: number;
  readonly eyes: number;
  readonly contact: number;
  /** Thrown by a swipe, whose release already gave its haptic. */
  readonly thrown: boolean;
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
  hopCaught(key);
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
  // How far from its planned start the row has carried it by the time it takes off.
  const carried = useSharedValue({ x: 0, y: 0 });
  const [eyesShut, setEyesShut] = useState(false);
  const { key, to, fades } = hop;
  const sleeps = hop.toStage === "asleep";
  // Before paint, so a leap's first frame is already its own, not where its row was measured.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fly or leap once the segment it goes to is measured, and report the landing.
  useLayoutEffect(() => {
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
    // It touches down on the segment's rim, then sinks through into its count.
    const plan = leapOf(
      middleOf(hop.from, zero),
      { ...middleOf(to, zero, hop.from.height * LANDING), surface: to.y },
      hop.thrown,
    );
    leap.set({
      ...leapFrames(plan),
      launch: plan.launch,
      eyes: plan.eyes,
      contact: plan.contact,
      thrown: plan.thrown,
    });
    const start = middleOf(hop.from, zero);
    const track = hop.track;
    runOnUI(() => {
      "worklet";
      // A swipe's row slides on between its measure and the flight's first frame: take off from
      // where it has carried the Cell, not from where it was measured.
      const now = track === null ? null : measure(track);
      carried.set(
        now === null || now.width === 0
          ? { x: 0, y: 0 }
          : { x: now.pageX + now.width / 2 - start.x, y: now.pageY + now.height / 2 - start.y },
      );
      // Linear: the leap's poses carry its gravity.
      clock.set(
        withTiming(plan.total, { duration: plan.total, easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(hopLanded)(key);
        }),
      );
    })();
  }, [key, to, sleeps, hop.from, hop.thrown, hop.track, progress, clock, leap, carried]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fade where it waits when its move went nowhere, and report it gone.
  useEffect(() => {
    if (!fades) return;
    shown.set(
      withTiming(0, ENTER, (finished) => {
        if (finished) runOnJS(hopFaded)(key);
      }),
    );
  }, [key, fades, shown]);
  // Its feet leave the ground, its eyes close past the top, and the count catches it.
  useAnimatedReaction(
    () => {
      const plan = leap.get();
      if (plan === null) return 0;
      const ms = clock.get();
      if (ms >= plan.contact) return 3;
      return ms >= plan.eyes ? 2 : ms >= plan.launch ? 1 : 0;
    },
    (phase, before) => {
      const was = before ?? 0;
      if (phase >= 1 && was < 1 && !leap.get()?.thrown) runOnJS(tookOff)();
      if (phase >= 2 && was < 2) runOnJS(setEyesShut)(true);
      if (phase === 3 && was < 3) runOnJS(caught)(key);
    },
  );
  const { width, height } = hop.from;
  const from = middleOf(hop.from, origin);
  const target = to === null ? from : middleOf(to, origin, LANDING_HEIGHT);
  const bow = Math.hypot(target.x - from.x, target.y - from.y) * BOW;
  const style = useAnimatedStyle(() => {
    const plan = leap.get();
    if (plan !== null) {
      const ms = clock.get();
      const pose = poseAt(plan, ms);
      // Its carry fades into its planned way by halfway down, as if it had always been on it.
      const t = Math.min(1, ms / (plan.contact * 0.5));
      const keep = 1 - t * t * (3 - 2 * t);
      const off = carried.get();
      return {
        opacity: shown.get() * pose.opacity,
        transform: [
          { translateX: pose.x + off.x * keep - origin.x - width / 2 },
          { translateY: pose.y + off.y * keep - origin.y - height / 2 },
          { rotate: `${pose.rotate}deg` },
          { scaleX: pose.scaleX },
          { scaleY: pose.scaleY },
        ],
      };
    }
    const p = progress.get();
    // A leap about to start draws nothing for its frame rather than where its row was measured.
    if (sleeps && to !== null) return { opacity: 0 };
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
