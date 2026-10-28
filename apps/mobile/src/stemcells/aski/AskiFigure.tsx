// Aski on the phone, at rest, as the Mac draws it: body in the text's ink, eyes in the colour
// beneath, so they read as cut out. The eyes blink with every Aski (`blinks.ts`) by squashing
// on the UI thread, so a blink redraws nothing; eyes wearing a mood hold it, and under Reduce
// Motion they don't blink.

import { useEffect } from "react";
import { type ColorValue, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { onBlink } from "./blinks";
import { BODY, EYE_LINE, eyesPath, VIEW } from "./drawing";
import { BLINK, EYES, type Mood } from "./kit";

/** The eyes' band, canon units: room for a typed character's reach either side of the line. */
const BAND = EYES.height * 1.2;

const eyesByMood = new Map<Mood | undefined, string>();
const eyesOf = (mood: Mood | undefined): string => {
  let d = eyesByMood.get(mood);
  if (d === undefined) eyesByMood.set(mood, (d = eyesPath(mood)));
  return d;
};

export function AskiFigure(props: {
  /** Points tall. */
  readonly height: number;
  /** The body's colour. */
  readonly ink: ColorValue | undefined;
  /** The colour behind the eyes. */
  readonly ground: ColorValue | undefined;
  /** What its eyes type, in place of the blocks. */
  readonly mood?: Mood | undefined;
}) {
  const scale = props.height / VIEW.height;
  const width = VIEW.width * scale;
  const open = useSharedValue(1);
  const holds = useReducedMotion() || props.mood !== undefined;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Subscribe to the shared blink clock while the eyes may blink, and unsubscribe on change or unmount.
  useEffect(() => {
    if (holds) return;
    return onBlink(() => {
      open.set(
        withSequence(
          withTiming(BLINK.shut, { duration: BLINK.close * 1000 }),
          withTiming(1, { duration: BLINK.open * 1000 }),
        ),
      );
    });
  }, [holds, open]);
  const blinking = useAnimatedStyle(() => ({ transform: [{ scaleY: open.get() }] }));
  return (
    <View
      pointerEvents="none"
      style={{ width, height: props.height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width={width}
        height={props.height}
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
      >
        <Path d={BODY} fill={props.ink} />
      </Svg>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            top: (EYE_LINE - BAND / 2 - VIEW.y) * scale,
            width,
            height: BAND * scale,
          },
          blinking,
        ]}
      >
        <Svg
          width={width}
          height={BAND * scale}
          viewBox={`${VIEW.x} ${EYE_LINE - BAND / 2} ${VIEW.width} ${BAND}`}
        >
          <Path d={eyesOf(props.mood)} fill={props.ground} />
        </Svg>
      </Animated.View>
    </View>
  );
}
