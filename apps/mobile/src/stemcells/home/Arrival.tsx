// A row entering its stage, the lists' enter (`listMotion.ts`): the first time it's seen there it
// fades in where it landed, then its light blooms once over its own and goes, so it rests at its
// state's level (none on Asleep). Nothing is mounted before or after.

import { use, useLayoutEffect } from "react";
import { type ViewStyle } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { RowLight } from "../glow/RowLight";
import { ROW_LIGHT } from "../line/kit";
import { cellKey } from "../line/line";
import { NativePrimaryColumnContext } from "../upstream/home";
import type { EnvironmentThreadShell } from "../upstream/cells";
import { arrivalDone, useArrives } from "./hops";
import { ENTER, LIST_MOTION } from "./listMotion";
import { HomeInFront, HomeStageContext } from "./state";

const RISE = { duration: LIST_MOTION.bloom.rise, easing: Easing.out(Easing.cubic) };
const FALL = { duration: LIST_MOTION.bloom.fall, easing: Easing.inOut(Easing.cubic) };

/** The row's last child: its light under the row's content, the fade over it. */
export function Arrival(props: {
  readonly thread: EnvironmentThreadShell;
  /** Where it lies over the row, and the Cell's middle from its left, as `RowLight`'s. */
  readonly fill: ViewStyle;
  readonly anchorX: number;
}) {
  const stage = use(HomeStageContext);
  // In sight: the home in front and this row's stage the one shown.
  const seen = use(HomeInFront);
  const key = cellKey(props.thread);
  const arrives = useArrives(key, stage);
  if (!arrives || !seen) return null;
  return (
    <Entering
      key={key}
      rowKey={key}
      thread={props.thread}
      fill={props.fill}
      anchorX={props.anchorX}
    />
  );
}

function Entering(props: {
  readonly thread: EnvironmentThreadShell;
  readonly fill: ViewStyle;
  readonly anchorX: number;
  readonly rowKey: string;
}) {
  const { rowKey } = props;
  const reduced = useReducedMotion();
  // The sidebar's rows stand on T3's ground, not the card's: they only bloom.
  const fades = !reduced && !use(NativePrimaryColumnContext);
  const card = useResolveClassNames("bg-grouped-card").backgroundColor;
  const veil = useSharedValue(fades ? 1 : 0);
  const light = useSharedValue(0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Run the fade and the bloom once on the UI thread as they mount; the entrance is made when they end.
  useLayoutEffect(() => {
    if (fades) veil.set(withTiming(0, ENTER));
    light.set(
      withDelay(
        fades ? ENTER.duration : 0,
        withSequence(
          withTiming(1, RISE),
          withTiming(0, FALL, (finished) => {
            if (finished) runOnJS(arrivalDone)(rowKey);
          }),
        ),
      ),
    );
  }, [fades, veil, light, rowKey]);
  const lit = useAnimatedStyle(() => ({ opacity: light.get() }));
  const veiled = useAnimatedStyle(() => ({ opacity: veil.get() }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[props.fill, { zIndex: -1 }, lit]}>
        <RowLight
          thread={props.thread}
          light={ROW_LIGHT.news}
          fill={FILL}
          anchorX={props.anchorX}
        />
      </Animated.View>
      {fades ? (
        <Animated.View
          pointerEvents="none"
          style={[props.fill, { backgroundColor: card }, veiled]}
        />
      ) : null}
    </>
  );
}

const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;
