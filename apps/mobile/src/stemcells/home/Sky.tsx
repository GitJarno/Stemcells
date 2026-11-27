// The sky behind the home's header (stemcells/tasks/day-night.md): dawn over Input, day over
// Awake, night over Asleep, and the sun rising or setting between. Drawn once, in layers whose opacity and place alone follow
// the one progress (`useSky.ts`), on the UI thread; while it stands, nothing moves or redraws.

import { memo, type ReactNode, use, useState } from "react";
import {
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import {
  CLOUDS,
  litPath,
  moonPhase,
  shown,
  SKY,
  SKY_SHAPE,
  SKY_SPANS,
  type SkyPalette,
  type SkySpan,
  skyStops,
  starGroups,
  warmth,
} from "../line/kit";
import {
  NativePrimaryColumnContext,
  useAppearancePreferences,
  useContentTopInset,
} from "../upstream/home";
import { STAGE_ROOM, useMinute } from "./state";
import { fallen } from "./useSky";

/** Where the sun and moon stand: clear of two trailing header buttons, in the bar's row. */
const BODY_FROM_RIGHT = 128;
const BODY_LEAST_ACROSS = 0.55;
const BODY_OVER_BAR_FOOT = 26;
/** How far down the header the stars reach, of the bar's foot. */
const STARS_REACH = 0.92;
const { r: R, sinks: SINKS, rises: RISES, halo: HALO } = SKY_SHAPE.body;

/**
 * The sky, from the screen's top to just past the first row's, where the bar's content lies over
 * the stages' lists. Android's bar stands in flow over the body, so there it draws none.
 */
export function Sky() {
  const top = useContentTopInset();
  const primaryColumn = use(NativePrimaryColumnContext);
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const { themeAppearance } = useAppearancePreferences();
  if (top === 0) return null;
  // The sidebar's width is its own: it draws once measured.
  const width = measured ?? (primaryColumn ? null : window.width);
  const height = top + STAGE_ROOM + SKY_SHAPE.tail;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: 0, right: 0, top: 0, height }}
      onLayout={({ nativeEvent }) => setMeasured(nativeEvent.layout.width)}
    >
      {width === null ? null : (
        <Heavens
          width={width}
          height={height}
          top={top}
          palette={SKY[themeAppearance === "light" ? "light" : "dark"]}
        />
      )}
    </View>
  );
}

const Heavens = memo(function Heavens(props: {
  readonly width: number;
  readonly height: number;
  /** The bar's foot. */
  readonly top: number;
  readonly palette: SkyPalette;
}) {
  const { width, height, top, palette } = props;
  const x = Math.max(width * BODY_LEAST_ACROSS, width - BODY_FROM_RIGHT);
  const y = top - BODY_OVER_BAR_FOOT;
  const whole = top / 2 / height;
  const reach = top * STARS_REACH;
  const fill = { position: "absolute", left: 0, top: 0, width, height } as const;
  return (
    <>
      <Fades span={SKY_SPANS.dayLifts} out style={fill}>
        <Gradient id="day" width={width} height={height} stops={skyStops(palette.day, whole)} />
      </Fades>
      <Fades span={SKY_SPANS.nightDeepens} style={fill}>
        <Gradient id="night" width={width} height={height} stops={skyStops(palette.night, whole)} />
      </Fades>
      <Warms peak={palette.warm.peak} style={fill}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="warm" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={palette.warm.inner} stopOpacity={1} />
              <Stop offset={0.5} stopColor={palette.warm.outer} stopOpacity={0.55} />
              <Stop offset={1} stopColor={palette.warm.outer} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={x} cy={top - 8} rx={width * 0.85} ry={height - top + 8} fill="url(#warm)" />
        </Svg>
      </Warms>
      <Fades span={SKY_SPANS.cloudsGo} out style={fill}>
        <Clouds
          id="clouds"
          width={width}
          reach={top}
          colour={palette.cloud.colour}
          alpha={palette.cloud.alpha}
        />
      </Fades>
      <Warms peak={1} style={fill}>
        <Clouds
          id="warm-clouds"
          width={width}
          reach={top}
          colour={palette.warm.inner}
          alpha={palette.cloud.alpha}
        />
      </Warms>
      {starGroups(x / width).map((stars, n) => (
        <Fades key={SKY_SPANS.stars[n]!.join()} span={SKY_SPANS.stars[n]!} style={fill}>
          <Svg width={width} height={height}>
            {stars.map((star) => (
              <Circle
                key={`${star.x}:${star.y}`}
                cx={star.x * width}
                cy={star.y * reach}
                r={star.r}
                fill={palette.star}
                fillOpacity={Math.min(1, star.alpha * palette.starLight)}
              />
            ))}
          </Svg>
        </Fades>
      ))}
      <Sun x={x} y={y} palette={palette} />
      <Moon x={x} y={y} palette={palette} />
    </>
  );
});

function Gradient(props: {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly stops: ReturnType<typeof skyStops>;
}) {
  return (
    <Svg width={props.width} height={props.height}>
      <Defs>
        <LinearGradient id={props.id} x1="0" y1="0" x2="0" y2="1">
          {props.stops.map((stop) => (
            <Stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={stop.colour}
              stopOpacity={stop.opacity}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect width={props.width} height={props.height} fill={`url(#${props.id})`} />
    </Svg>
  );
}

/** Two wisps, each a soft ellipse and a smaller lobe over it. */
function Clouds(props: {
  readonly id: string;
  readonly width: number;
  readonly reach: number;
  readonly colour: string;
  readonly alpha: number;
}) {
  return (
    <Svg width={props.width} height={props.reach}>
      <Defs>
        <RadialGradient id={props.id} cx="50%" cy="50%" r="50%">
          <Stop offset={0} stopColor={props.colour} stopOpacity={props.alpha} />
          <Stop offset={1} stopColor={props.colour} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {CLOUDS.map((cloud) => {
        const cx = cloud.x * props.width;
        const cy = cloud.y * props.reach;
        return [
          <Ellipse
            key={`${cloud.x}`}
            cx={cx}
            cy={cy}
            rx={cloud.width / 2}
            ry={cloud.height / 2}
            fill={`url(#${props.id})`}
          />,
          <Ellipse
            key={`${cloud.x}:lobe`}
            cx={cx + cloud.width * 0.18}
            cy={cy - cloud.height * 0.35}
            rx={cloud.width / 4}
            ry={cloud.height * 0.4}
            fill={`url(#${props.id})`}
          />,
        ];
      })}
    </Svg>
  );
}

/** A layer coming in over `span` of the turn, or going (`out`). */
function Fades(props: {
  readonly span: SkySpan;
  readonly out?: boolean;
  readonly style: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const { span, out = false } = props;
  const fades = useAnimatedStyle(() => {
    const p = shown(fallen.get(), span);
    return { opacity: out ? 1 - p : p };
  });
  return <Animated.View style={[props.style, fades]}>{props.children}</Animated.View>;
}

/** A layer of the horizon's warmth, at `peak` mid-turn and gone at either end. */
function Warms(props: {
  readonly peak: number;
  readonly style: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const { peak } = props;
  const warms = useAnimatedStyle(() => ({ opacity: warmth(fallen.get()) * peak }));
  return <Animated.View style={[props.style, warms]}>{props.children}</Animated.View>;
}

/** A body's soft halo and disc, centred in a box of `2 * HALO * R`. */
function Disc(props: { readonly id: string; readonly colour: string; readonly halo: number }) {
  const box = 2 * HALO * R;
  return (
    <Svg width={box} height={box} style={{ position: "absolute" }}>
      <Defs>
        <RadialGradient id={props.id} cx="50%" cy="50%" r="50%">
          <Stop offset={0} stopColor={props.colour} stopOpacity={props.halo} />
          <Stop offset={1} stopColor={props.colour} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={box / 2} cy={box / 2} r={box / 2} fill={`url(#${props.id})`} />
      <Circle cx={box / 2} cy={box / 2} r={R} fill={props.colour} />
    </Svg>
  );
}

const boxAt = (x: number, y: number) =>
  ({
    position: "absolute",
    left: x - HALO * R,
    top: y - HALO * R,
    width: 2 * HALO * R,
    height: 2 * HALO * R,
  }) as const;

/** The sun: it warms as it sinks toward the horizon, and goes as the moon comes. */
function Sun(props: { readonly x: number; readonly y: number; readonly palette: SkyPalette }) {
  const reduced = useReducedMotion();
  const sets = useAnimatedStyle(() => {
    const p = fallen.get();
    return {
      opacity: 1 - shown(p, SKY_SPANS.sunGoes),
      // Under Reduce Motion nothing moves: the sun and the moon only fade where they stand.
      transform: [{ translateY: reduced ? 0 : shown(p, SKY_SPANS.sunSinks) * SINKS }],
    };
  });
  const { palette } = props;
  return (
    <Animated.View style={[boxAt(props.x, props.y), sets]}>
      <Disc id="sun" colour={palette.sun} halo={palette.halo} />
      <Fades span={SKY_SPANS.sunWarms} style={StyleSheet.absoluteFill}>
        <Disc id="setting" colour={palette.setting} halo={palette.halo} />
      </Fades>
    </Animated.View>
  );
}

/** The moon at tonight's phase, rising into place as the sun goes. */
function Moon(props: { readonly x: number; readonly y: number; readonly palette: SkyPalette }) {
  // Held to a few hundred phases, so the path redraws a few times a day, not each minute.
  const phase = Math.round(moonPhase(Date.parse(useMinute())) * 240) / 240;
  const reduced = useReducedMotion();
  const rises = useAnimatedStyle(() => {
    const p = fallen.get();
    return {
      opacity: shown(p, SKY_SPANS.moonComes),
      transform: [{ translateY: reduced ? 0 : (1 - shown(p, SKY_SPANS.moonRises)) * RISES }],
    };
  });
  const { palette } = props;
  const middle = HALO * R;
  return (
    <Animated.View style={[boxAt(props.x, props.y), rises]}>
      <Svg width={2 * middle} height={2 * middle} style={{ position: "absolute" }}>
        <Defs>
          <RadialGradient id="moonlight" cx="50%" cy="50%" r="50%">
            <Stop offset={0} stopColor={palette.moon} stopOpacity={palette.halo} />
            <Stop offset={1} stopColor={palette.moon} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={middle} cy={middle} r={middle} fill="url(#moonlight)" />
        <Circle cx={middle} cy={middle} r={R} fill={palette.moonShadow} />
        <Path
          d={litPath(phase, R)}
          fill={palette.moon}
          transform={`translate(${middle} ${middle})`}
        />
      </Svg>
    </Animated.View>
  );
}
