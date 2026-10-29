// A Flying card's light, as the Mac's composer wears it while its Cell works (`apps/web/src/
// stemcells/glow/`): the provider's wash from the Cell across the card, and a band crossing the
// screen once a beat on the wall clock, so the cards' crests are one wave, in step with the Mac's.
// The band holds off the card while the home is out of sight or motion is reduced.

import { use, useEffect, useId, useRef, useState } from "react";
import { AppState, useWindowDimensions, View, type ViewInstance } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import { useDriverOf } from "../cell/ThreadCell";
import { HomeInFront, HomeTabsContext } from "../home/state";
import { GLOW, TONES } from "../tokens";
import type { EnvironmentThreadShell } from "../upstream/cells";
import { rgbOf, stopOf } from "./colour";
import {
  BAND_LEAN,
  BEAT_POINTS,
  bandStops,
  bandWidth,
  crossing,
  luminanceOf,
  type Rgb,
  strength,
  toneTokenOf,
  WASH,
  washColours,
  washEnds,
} from "./kit";

/**
 * The card's content padding, the row's `pl-3 pr-4 py-3`
 * (`upstream/substitutes/thread-list-v2-row-appearance.ts`): the light fills the card from inside it.
 */
const CARD_PADDING = { top: 12, right: 16, bottom: 12, left: 12 } as const;
/** The Cell's middle across the card: its column is 52 points wide, inside the card's padding. */
const CELL_MIDDLE = CARD_PADDING.left + 26;
const BEAT_EASING = Easing.bezier(...BEAT_POINTS);
const FILL = {
  position: "absolute",
  top: -CARD_PADDING.top,
  right: -CARD_PADDING.right,
  bottom: -CARD_PADDING.bottom,
  left: -CARD_PADDING.left,
} as const;

/** The card's light, on the home's Flying tab only; anywhere else, nothing. */
export function CardLight(props: { readonly thread: EnvironmentThreadShell }) {
  const flying = use(HomeTabsContext)?.tab === "working";
  return flying ? <Light thread={props.thread} /> : null;
}

function Light(props: { readonly thread: EnvironmentThreadShell }) {
  // react-native-svg reads a gradient's `url(#…)` by id: no colons in it.
  const id = useId().replaceAll(":", "");
  const box = useRef<ViewInstance>(null);
  const [frame, setFrame] = useState<{ left: number; width: number; height: number } | null>(null);
  const screen = useWindowDimensions().width;
  const inFront = use(HomeInFront);
  const reduced = useReducedMotion();
  const awake = useAwake();
  const tone = rgbOf(TONES[toneTokenOf(useDriverOf(props.thread))] ?? TONES["--sc-accent"])!;
  const glass = rgbOf(useResolveClassNames("bg-grouped-card").backgroundColor) ?? [0, 0, 0];
  const ink = rgbOf(useResolveClassNames("text-foreground").color) ?? [255, 255, 255];
  const x = useSharedValue(0);
  const band = frame === null ? 0 : bandWidth(frame);
  const path = frame === null ? null : crossing(screen, frame.left, band / 2);
  const from = path?.from ?? null;
  const to = path?.to ?? null;
  const runs = inFront && awake && !reduced;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Run the band on the wall clock's beat while the card can be seen; hold it off the card otherwise.
  useEffect(() => {
    if (from === null || to === null) return;
    x.set(from);
    if (!runs) return;
    const period = GLOW.pass + GLOW.rest;
    const pass = withTiming(to, { duration: GLOW.pass, easing: BEAT_EASING });
    const back = withDelay(GLOW.rest, withTiming(from, { duration: 0 }));
    x.set(
      withDelay(
        (period - (Date.now() % period)) % period,
        withRepeat(withSequence(pass, back), -1),
      ),
    );
    return () => cancelAnimation(x);
  }, [runs, from, to, x]);
  const moving = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { skewX: `${-BAND_LEAN}rad` }],
  }));

  const measure = () =>
    box.current?.measureInWindow((left, _top, width, height) => {
      if (width > 0) setFrame({ left, width, height });
    });
  return (
    <View ref={box} pointerEvents="none" style={FILL} onLayout={measure}>
      {frame === null ? null : (
        <>
          <Wash id={`${id}-wash`} tone={tone} size={frame} />
          <Animated.View
            style={[
              { position: "absolute", top: 0, left: 0, width: band, height: frame.height },
              moving,
            ]}
          >
            <Band
              id={`${id}-band`}
              tone={tone}
              alpha={strength(tone, glass, luminanceOf(ink) > luminanceOf(glass))}
              width={band}
              height={frame.height}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}

/** The provider's colour washed across the card from its Cell, deepest there. */
function Wash(props: {
  readonly id: string;
  readonly tone: Rgb;
  readonly size: { readonly width: number; readonly height: number };
}) {
  const { width, height } = props.size;
  const anchor = { x: CELL_MIDDLE, y: height / 2 };
  const { far } = washEnds(props.size, anchor);
  const colours = washColours(props.tone);
  return (
    <Svg width={width} height={height} style={{ position: "absolute" }}>
      <Defs>
        <LinearGradient
          id={props.id}
          gradientUnits="userSpaceOnUse"
          x1={anchor.x}
          y1={anchor.y}
          x2={far.x}
          y2={far.y}
        >
          {WASH.map((stop, i) => {
            const { color, opacity } = stopOf(colours[i]!);
            return <Stop key={stop.at} offset={stop.at} stopColor={color} stopOpacity={opacity} />;
          })}
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${props.id})`} />
    </Svg>
  );
}

/** The band: the tone in a raised cosine, its edges turned a little round the hue. */
function Band(props: {
  readonly id: string;
  readonly tone: Rgb;
  readonly alpha: number;
  readonly width: number;
  readonly height: number;
}) {
  return (
    <Svg width={props.width} height={props.height}>
      <Defs>
        <LinearGradient id={props.id} x1={0} y1={0} x2={1} y2={0}>
          {bandStops(props.tone, props.alpha).map((stop) => {
            const { color, opacity, offset } = stopOf(stop);
            return <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />;
          })}
        </LinearGradient>
      </Defs>
      <Rect width={props.width} height={props.height} fill={`url(#${props.id})`} />
    </Svg>
  );
}

/** Whether the app is in front; a return starts the beat again where the wall clock is. */
function useAwake(): boolean {
  const [awake, setAwake] = useState(AppState.currentState === "active");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Follow the app in and out of the front, so the band holds while it's away and rejoins the beat on return.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => setAwake(next === "active"));
    return () => subscription.remove();
  }, []);
  return awake;
}
