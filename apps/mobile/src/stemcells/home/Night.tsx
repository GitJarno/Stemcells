// The night over the Asleep tab: a dark sky, stars, the moon at tonight's phase, and now and
// then a shooting star. It stands still between shooting stars (nothing repaints); they come
// only while the app is in front, and not at all under Reduce Motion.

import { useEffect, useState } from "react";
import { AppState, type ColorValue, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { litPath, moonPhase } from "./moon";
import { DEEP, DEEP_AT, hex, skyAt, TOP } from "./sky";
import { useMinute } from "./state";

/** The moon: across the header's width, points down from its top, its radius. */
const MOON = { x: 0.8, y: 34, r: 13 };
const MOONLIGHT = "#F2EFE6";
/** The moon's unlit part, a little lighter than the sky it crosses. */
const MOON_DARK = "#1A1D3A";

const STARS = (() => {
  let seed = 46;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 46 }, () => ({
    x: random(),
    y: random() * 0.62,
    r: 0.4 + random() * 0.7,
    alpha: 0.1 + random() * 0.32,
  }));
})();

/** How long between shooting stars, and how long one lasts, in ms. */
const SHOOTS_EVERY = 9_000;
const SHOOTS_FOR = 850;

/** Shooting stars across the box from (`left`, `top`), `width` by `height`. */
function ShootingStar(props: {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}) {
  const flight = useSharedValue(0);
  const [from, setFrom] = useState({ x: 0, y: 0 });
  // oxlint-disable-next-line t3code/react-effect-budget -- Schedule shooting stars while the app is active, and clear the timer and AppState listener on unmount.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let shots = 0;
    const arm = () => {
      clearTimeout(timer);
      if (AppState.currentState !== "active") return;
      timer = setTimeout(() => {
        shots += 1;
        setFrom({ x: (shots * 0.37) % 0.6, y: (shots * 0.23) % 1 });
        flight.value = 0;
        flight.value = withTiming(1, { duration: SHOOTS_FOR, easing: Easing.out(Easing.quad) });
        arm();
      }, SHOOTS_EVERY);
    };
    arm();
    const listening = AppState.addEventListener("change", arm);
    return () => {
      clearTimeout(timer);
      listening.remove();
    };
  }, [flight]);
  const style = useAnimatedStyle(() => ({
    opacity: flight.value === 0 ? 0 : Math.sin(flight.value * Math.PI),
    transform: [
      { translateX: flight.value * 150 },
      { translateY: flight.value * 52 },
      { rotate: "19deg" },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: props.left + from.x * props.width,
          top: props.top + from.y * props.height,
          width: 70,
          height: 1.5,
        },
        style,
      ]}
    >
      <Svg width={70} height={1.5}>
        <Defs>
          <LinearGradient id="tail" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.9} />
          </LinearGradient>
        </Defs>
        <Rect width={70} height={1.5} rx={0.75} fill="url(#tail)" />
      </Svg>
    </Animated.View>
  );
}

/**
 * The night behind the home's header, filling it and reaching `above`
 * points over it (the status bar, and a pull past the top). `screen` is the
 * colour it fades into at the header's foot.
 */
export function Night(props: { readonly above: number; readonly screen: ColorValue | undefined }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const reduced = useReducedMotion();
  const phase = moonPhase(Date.parse(useMinute()));
  const { above } = props;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, top: -above, bottom: 0 }}
      onLayout={({ nativeEvent: { layout } }) =>
        setSize({ width: layout.width, height: layout.height - above })
      }
    >
      {size === null ? null : (
        <>
          <Svg width={size.width} height={above + size.height}>
            <Defs>
              <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <Stop offset={0} stopColor={hex(TOP)} />
                <Stop offset={DEEP_AT} stopColor={hex(DEEP)} />
                <Stop offset={1} stopColor={props.screen} />
              </LinearGradient>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={MOONLIGHT} stopOpacity={0.22} />
                <Stop offset="1" stopColor={MOONLIGHT} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={size.width} height={above} fill={skyAt(0)} />
            <Rect y={above} width={size.width} height={size.height} fill="url(#sky)" />
            {STARS.map((star) => (
              <Circle
                key={`${star.x}:${star.y}`}
                cx={star.x * size.width}
                cy={above + star.y * size.height}
                r={star.r}
                fill="#FFFFFF"
                fillOpacity={star.alpha}
              />
            ))}
            <Circle
              cx={MOON.x * size.width}
              cy={above + MOON.y}
              r={MOON.r * 2.6}
              fill="url(#glow)"
            />
            <Circle cx={MOON.x * size.width} cy={above + MOON.y} r={MOON.r} fill={MOON_DARK} />
            <Path
              d={litPath(phase, MOON.r)}
              fill={MOONLIGHT}
              transform={`translate(${MOON.x * size.width} ${above + MOON.y})`}
            />
          </Svg>
          {reduced ? null : (
            <ShootingStar
              left={size.width * 0.05}
              top={above + size.height * 0.08}
              width={size.width}
              height={size.height * 0.25}
            />
          )}
        </>
      )}
    </View>
  );
}
