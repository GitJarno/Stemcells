// The night over Settled: a dark sky, stars, the moon at tonight's phase, and now and then a
// shooting star. It falls and lifts in layers, each on its span of one progress (`nightfall.ts`),
// redrawing nothing, and stands still between shooting stars, which come only while the app is
// in front, and not under Reduce Motion.

import { type ReactNode, useEffect, useState } from "react";
import {
  AppState,
  type ColorValue,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
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
import { type Part, PARTS, shown } from "./nightfall";
import { DEEP, DEEP_AT, hex, skyAt, TOP } from "./sky";
import { useMinute } from "./state";
import { fallen } from "./useNight";

/** The moon: across the header's width, points down from its top, its radius. */
const MOON = { x: 0.8, y: 34, r: 13 };
const MOONLIGHT = "#F2EFE6";
/** The moon's unlit part, a little lighter than the sky it crosses. */
const MOON_DARK = "#1A1D3A";
/** How far the moon's glow reaches from its centre, and how far the moon rises into place. */
const GLOW = MOON.r * 2.6;
const RISE = 8;

/** How far down the header the stars reach, of its height. */
const STARS_REACH = 0.62;
const STARS = (() => {
  let seed = 46;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 46 }, () => ({
    x: random(),
    y: random() * STARS_REACH,
    r: 0.4 + random() * 0.7,
    alpha: 0.1 + random() * 0.32,
  }));
})();

/** The stars by brightness, one group to each of their spans: the brightest come out first. */
const STAR_GROUPS = (() => {
  const brightest = [...STARS].sort((a, b) => b.alpha - a.alpha);
  const size = Math.ceil(brightest.length / PARTS.stars.length);
  return PARTS.stars.map((part, n) => ({
    part,
    stars: brightest.slice(n * size, (n + 1) * size),
  }));
})();
/** Room round the stars' layers for the largest star. */
const STAR_ROOM = 2;

/** How long between shooting stars, and how long one lasts, in ms. */
const SHOOTS_EVERY = 9_000;
const SHOOTS_FOR = 850;

/**
 * What the night brings, as far as its `part` (the sky's, unless said) has come: over the
 * day's own look, they cross as the sky comes in. Drawn as one layer, untouched and unread.
 */
export function AtNight(props: {
  readonly part?: Part;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const part = props.part ?? PARTS.sky;
  const reduced = useReducedMotion();
  const comes = useAnimatedStyle(() => ({ opacity: shown(fallen.get(), part, reduced) }));
  return (
    <Animated.View
      pointerEvents="none"
      // Android fades each view alone; the eyes over the ink must fade as one picture.
      needsOffscreenAlphaCompositing
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[props.style, comes]}
    >
      {props.children}
    </Animated.View>
  );
}

/** The moon centred at (`x`, `y`), rising into place as it comes out, its glow after it. */
function Moon(props: { readonly x: number; readonly y: number }) {
  const phase = moonPhase(Date.parse(useMinute()));
  const reduced = useReducedMotion();
  const rises = useAnimatedStyle(() => {
    const out = shown(fallen.get(), PARTS.moon, reduced);
    return { opacity: out, transform: [{ translateY: reduced ? 0 : (1 - out) * RISE }] };
  });
  const box = 2 * GLOW;
  return (
    <Animated.View
      needsOffscreenAlphaCompositing
      style={[
        {
          position: "absolute",
          left: props.x - GLOW,
          top: props.y - GLOW,
          width: box,
          height: box,
        },
        rises,
      ]}
    >
      <AtNight part={PARTS.glow} style={StyleSheet.absoluteFill}>
        <Svg width={box} height={box}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={MOONLIGHT} stopOpacity={0.22} />
              <Stop offset="1" stopColor={MOONLIGHT} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW} cy={GLOW} r={GLOW} fill="url(#glow)" />
        </Svg>
      </AtNight>
      <Svg width={box} height={box}>
        <Circle cx={GLOW} cy={GLOW} r={MOON.r} fill={MOON_DARK} />
        <Path
          d={litPath(phase, MOON.r)}
          fill={MOONLIGHT}
          transform={`translate(${GLOW} ${GLOW})`}
        />
      </Svg>
    </Animated.View>
  );
}

/** Shooting stars across the box from (`left`, `top`), `width` by `height`. */
function ShootingStar(props: {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}) {
  const flight = useSharedValue(0);
  const [from, setFrom] = useState({ x: 0, y: 0 });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Schedule shooting stars while the app is active, and clear the timer and AppState listener on unmount.
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
 * The night behind the home's header, reaching `above` points over it and
 * fading into `screen` at its foot. Given the header's measured `height`, it
 * draws in its first frame, across the window, until its own layout lands.
 * Shooting stars come only while it is `shooting`: the first a while after it falls.
 */
export function Night(props: {
  readonly above: number;
  readonly screen: ColorValue | undefined;
  readonly height: number;
  readonly shooting: boolean;
}) {
  const window = useWindowDimensions();
  const [measured, setSize] = useState<{ width: number; height: number } | null>(null);
  const size =
    measured ?? (props.height > 0 ? { width: window.width, height: props.height } : null);
  const reduced = useReducedMotion();
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
          <AtNight style={StyleSheet.absoluteFill}>
            <Svg width={size.width} height={above + size.height}>
              <Defs>
                <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset={0} stopColor={hex(TOP)} />
                  <Stop offset={DEEP_AT} stopColor={hex(DEEP)} />
                  <Stop offset={1} stopColor={props.screen} />
                </LinearGradient>
              </Defs>
              <Rect width={size.width} height={above} fill={skyAt(0)} />
              <Rect y={above} width={size.width} height={size.height} fill="url(#sky)" />
            </Svg>
          </AtNight>
          {STAR_GROUPS.map(({ part, stars }) => (
            <AtNight
              key={part[0]}
              part={part}
              style={{ position: "absolute", left: 0, top: above - STAR_ROOM }}
            >
              <Svg width={size.width} height={STARS_REACH * size.height + 2 * STAR_ROOM}>
                {stars.map((star) => (
                  <Circle
                    key={`${star.x}:${star.y}`}
                    cx={star.x * size.width}
                    cy={STAR_ROOM + star.y * size.height}
                    r={star.r}
                    fill="#FFFFFF"
                    fillOpacity={star.alpha}
                  />
                ))}
              </Svg>
            </AtNight>
          ))}
          <Moon x={MOON.x * size.width} y={above + MOON.y} />
          {reduced || !props.shooting ? null : (
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
