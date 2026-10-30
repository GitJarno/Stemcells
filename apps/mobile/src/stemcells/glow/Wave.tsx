// The Flying light, as the Mac's composer wears it while its Cell works (`apps/web/src/
// stemcells/glow/`): the provider's wash from an anchor across what it fills, and a band crossing
// the screen once a beat on the wall clock, so every light's crest is one wave, in step with the
// Mac's. The band holds still while it's out of sight, the app is away or motion is reduced.

import { useEffect, useId, useRef, useState } from "react";
import {
  AppState,
  useWindowDimensions,
  View,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
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

import { GLOW } from "../tokens";
import { stopOf } from "./colour";
import {
  BAND_LEAN,
  BEAT_POINTS,
  bandStops,
  bandWidth,
  crossing,
  luminanceOf,
  type Rgb,
  strength,
  WASH,
  washColours,
  washEnds,
} from "./kit";

const BEAT_EASING = Easing.bezier(...BEAT_POINTS);

export function Wave(props: {
  /** The provider's tone. */
  readonly tone: Rgb;
  /** The surface it lights, and the ink drawn on it. */
  readonly glass: Rgb;
  readonly ink: Rgb;
  /** Where the wash is deepest, from the left of what it fills. */
  readonly anchorX: number;
  /** Where it lies: absolutely, over what it fills. */
  readonly fill: ViewStyle;
  /** Whether what it lights can be seen. */
  readonly inSight: boolean;
}) {
  // react-native-svg reads a gradient's `url(#…)` by id: no colons in it.
  const id = useId().replaceAll(":", "");
  const box = useRef<ViewInstance>(null);
  const [frame, setFrame] = useState<{ left: number; width: number; height: number } | null>(null);
  const screen = useWindowDimensions().width;
  const reduced = useReducedMotion();
  const awake = useAwake();
  const x = useSharedValue(0);
  const band = frame === null ? 0 : bandWidth(frame);
  const path = frame === null ? null : crossing(screen, frame.left, band / 2);
  const from = path?.from ?? null;
  const to = path?.to ?? null;
  const runs = props.inSight && awake && !reduced;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Run the band on the wall clock's beat while the light can be seen; hold it off otherwise.
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
    <View ref={box} pointerEvents="none" style={props.fill} onLayout={measure}>
      {frame === null ? null : (
        <>
          <Wash id={`${id}-wash`} tone={props.tone} size={frame} anchorX={props.anchorX} />
          <Animated.View
            style={[
              { position: "absolute", top: 0, left: 0, width: band, height: frame.height },
              moving,
            ]}
          >
            <Band
              id={`${id}-band`}
              tone={props.tone}
              alpha={strength(
                props.tone,
                props.glass,
                luminanceOf(props.ink) > luminanceOf(props.glass),
              )}
              width={band}
              height={frame.height}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}

/** The provider's colour washed across from the anchor, deepest there. */
function Wash(props: {
  readonly id: string;
  readonly tone: Rgb;
  readonly size: { readonly width: number; readonly height: number };
  readonly anchorX: number;
}) {
  const { width, height } = props.size;
  const anchor = { x: props.anchorX, y: height / 2 };
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
