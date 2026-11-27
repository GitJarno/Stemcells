// The stages at the home's foot, just over its search, where a thumb reaches them and they never
// scroll away, as the Mac's column keeps its stages at its foot (stemcells/tasks/awake-asleep.md).
// Both lists start at the same height, under the header's sky (`Sky.tsx`). A slept or woken Cell
// flies to its new stage's segment (`hops.ts`), and the count takes it with a bump.

import { use, useEffect, useRef, useState } from "react";
import { View, type ViewInstance } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { SegmentedControl } from "../upstream/home";
import { bumpNow, pillStandsIn, useBump } from "./hops";
import { LIST_MOTION } from "./listMotion";
import { useOverKeyboard } from "./overKeyboard";
import {
  HomeInFront,
  HomeStageContext,
  HomeTabsContext,
  liftNotices,
  PILL_ROOM,
  STAGE_ROOM,
} from "./state";

/** How much the pill grows round the segment a Cell lands in, at the bump's height. */
const BUMP = 0.04;
const BUMP_UP = { duration: LIST_MOTION.tick.duration * 0.35, easing: Easing.out(Easing.cubic) };
const BUMP_DOWN = {
  duration: LIST_MOTION.tick.duration * 0.65,
  easing: Easing.inOut(Easing.cubic),
};

/** The stages, over the home's search. */
export function StagePill() {
  const home = use(HomeTabsContext);
  const inFront = use(HomeInFront);
  const { place, style } = useOverKeyboard();
  const lift = place.pill + PILL_ROOM - place.notice;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Tell T3's undo notice, drawn outside the home, to stand over the stages.
  useEffect(() => (inFront ? liftNotices(lift) : undefined), [inFront, lift]);
  const box = useRef<ViewInstance>(null);
  const stages = home?.options.map((option) => option.id).join(" ") ?? "";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Tell the hops where the pill stands while it's in sight, so a moved Cell can fly to its segment.
  useEffect(
    () => (inFront ? pillStandsIn(box.current, stages.split(" ")) : undefined),
    [inFront, stages],
  );
  const bumped = useBump();
  // Landings before this pill stood are done: a pill drawn again bumps for none of them.
  const [landedBefore] = useState(() => bumpNow()?.count ?? 0);
  const [width, setWidth] = useState(0);
  const bump = useSharedValue(0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Bump the pill once on the UI thread as a Cell lands in a segment's count.
  useEffect(() => {
    if (bumped === null || bumped.count <= landedBefore) return;
    bump.set(withSequence(withTiming(1, BUMP_UP), withTiming(0, BUMP_DOWN)));
  }, [bumped, bump, landedBefore]);
  const at = home === null || bumped === null ? -1 : stages.split(" ").indexOf(bumped.stage);
  const count = home?.options.length ?? 1;
  const middle = at < 0 ? width / 2 : (width * (at + 0.5)) / count;
  const bumping = useAnimatedStyle(() => ({ transform: [{ scale: 1 + BUMP * bump.get() }] }));
  if (home === null) return null;
  return (
    <Animated.View
      ref={box}
      pointerEvents="box-none"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        {
          position: "absolute",
          left: place.left,
          right: place.right,
          transformOrigin: [middle, "50%", 0],
        },
        style,
        bumping,
      ]}
    >
      <SegmentedControl
        role="tab"
        options={home.options.map(({ id, label, count }) => ({
          value: id,
          label: count > 0 ? `${label} ${count}` : label,
          accessibilityLabel: `${label}, ${count}`,
        }))}
        selected={home.tab}
        onSelect={home.choose}
      />
    </Animated.View>
  );
}

/** A stage's list's top: the same room over every stage's first row. */
export function StageTop() {
  const stage = use(HomeStageContext);
  if (stage === null) return null;
  return <View style={{ height: STAGE_ROOM }} />;
}
