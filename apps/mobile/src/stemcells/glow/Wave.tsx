// The Flying light, as the Mac's composer wears it (`apps/web/src/stemcells/glow/`): the
// provider's wash from an anchor, and a band crossing the screen once a beat on the wall clock, in
// step with the Mac's; held still out of sight, while the app is away or motion is reduced. Without
// the band it is the wash alone, with no clock and no listener.

import { useEffect, useId, useRef, useState } from "react";
import {
  AppState,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Mask, RadialGradient, Rect, Stop } from "react-native-svg";

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
/**
 * A row's lamp, as the Mac's (`apps/web/src/stemcells/rail/cells.css`, `[data-cells-light]`): an
 * ellipse round the Cell, this share of the row wide and as tall as the row, so it is gone by the
 * row's edges and lit rows never meet as boxes.
 */
const LAMP = {
  reach: 0.72,
  stops: [
    { at: 0, alpha: 0.3 },
    { at: 0.5, alpha: 0.1 },
    { at: 1, alpha: 0 },
  ],
} as const;
/** The band over a row, feathered top and bottom as the lamp is. */
const FEATHER = [
  { at: 0, alpha: 0 },
  { at: 0.35, alpha: 1 },
  { at: 0.65, alpha: 1 },
  { at: 1, alpha: 0 },
] as const;
/** A landing ends the band: it fades as the light comes to rest. */
const BAND_ENDS = FadeOut.duration(400);

type Size = { readonly width: number; readonly height: number };

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
  /** The band crossing on the beat; without it the wash rests. On by default. */
  readonly band?: boolean;
  /** A row's lamp round the anchor, where the wash would reach across what it fills. */
  readonly glow?: boolean;
}) {
  // react-native-svg reads a gradient's `url(#…)` by id: no colons in it.
  const id = useId().replaceAll(":", "");
  const [size, setSize] = useState<Size | null>(null);
  return (
    <View
      pointerEvents="none"
      style={props.fill}
      onLayout={({ nativeEvent: { layout } }) =>
        setSize((before) =>
          before?.width === layout.width && before.height === layout.height
            ? before
            : { width: layout.width, height: layout.height },
        )
      }
    >
      {size === null || size.width === 0 ? null : (
        <>
          {props.glow === true ? (
            <Glow id={`${id}-lamp`} tone={props.tone} size={size} anchorX={props.anchorX} />
          ) : (
            <Wash id={`${id}-wash`} tone={props.tone} size={size} anchorX={props.anchorX} />
          )}
          {props.band === false ? null : (
            <Crossing
              id={`${id}-band`}
              tone={props.tone}
              glass={props.glass}
              ink={props.ink}
              size={size}
              inSight={props.inSight}
              feathered={props.glow === true}
            />
          )}
        </>
      )}
    </View>
  );
}

/** The band crossing the screen once a beat on the wall clock, over what the wash fills. */
function Crossing(props: {
  readonly id: string;
  readonly tone: Rgb;
  readonly glass: Rgb;
  readonly ink: Rgb;
  readonly size: Size;
  readonly inSight: boolean;
  readonly feathered: boolean;
}) {
  const box = useRef<ViewInstance>(null);
  const [left, setLeft] = useState<number | null>(null);
  const screen = useWindowDimensions().width;
  const reduced = useReducedMotion();
  const awake = useAwake();
  const x = useSharedValue(0);
  const band = bandWidth(props.size);
  const path = left === null ? null : crossing(screen, left, band / 2);
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
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill} exiting={BAND_ENDS}>
      <View
        ref={box}
        style={StyleSheet.absoluteFill}
        onLayout={() =>
          box.current?.measureInWindow((at, _top, width) => {
            if (width > 0) setLeft(at);
          })
        }
      />
      <Animated.View
        style={[
          { position: "absolute", top: 0, left: 0, width: band, height: props.size.height },
          moving,
        ]}
      >
        <Band
          id={props.id}
          tone={props.tone}
          alpha={strength(
            props.tone,
            props.glass,
            luminanceOf(props.ink) > luminanceOf(props.glass),
          )}
          width={band}
          height={props.size.height}
          feathered={props.feathered}
        />
      </Animated.View>
    </Animated.View>
  );
}

/** The provider's colour washed across from the anchor, deepest there. */
function Wash(props: {
  readonly id: string;
  readonly tone: Rgb;
  readonly size: Size;
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

/** A row's lamp: the tone round the anchor, fading out before the row's edges. */
function Glow(props: {
  readonly id: string;
  readonly tone: Rgb;
  readonly size: Size;
  readonly anchorX: number;
}) {
  const { width, height } = props.size;
  const colour = `rgb(${props.tone.join(", ")})`;
  return (
    <Svg width={width} height={height} style={{ position: "absolute" }}>
      <Defs>
        <RadialGradient
          id={props.id}
          gradientUnits="userSpaceOnUse"
          cx={props.anchorX}
          cy={height / 2}
          rx={width * LAMP.reach}
          ry={height / 2}
        >
          {LAMP.stops.map((stop) => (
            <Stop key={stop.at} offset={stop.at} stopColor={colour} stopOpacity={stop.alpha} />
          ))}
        </RadialGradient>
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
  readonly feathered: boolean;
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
        {props.feathered ? (
          <>
            <LinearGradient id={`${props.id}-feather`} x1={0} y1={0} x2={0} y2={1}>
              {FEATHER.map((stop) => (
                <Stop key={stop.at} offset={stop.at} stopColor="#fff" stopOpacity={stop.alpha} />
              ))}
            </LinearGradient>
            <Mask id={`${props.id}-mask`}>
              <Rect width={props.width} height={props.height} fill={`url(#${props.id}-feather)`} />
            </Mask>
          </>
        ) : null}
      </Defs>
      <Rect
        width={props.width}
        height={props.height}
        fill={`url(#${props.id})`}
        mask={props.feathered ? `url(#${props.id}-mask)` : undefined}
      />
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
