// The sky behind the home's header (stemcells/tasks/day-night.md): day over Input and Awake,
// night over Asleep. Drawn once, in layers whose opacity and place alone follow the one progress
// (`useSky.ts`), on the UI thread; while it stands, nothing moves but a rare visitor (`Visits`).
// It goes up and out with the title as the list in front scrolls (`head.ts`).

import { memo, type ReactNode, use, useEffect, useRef, useState } from "react";
import {
  AppState,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
  BIRD_PATH,
  BIRDS,
  birdsAt,
  CLOUDS,
  litPath,
  nextVisit,
  SEED,
  seedAt,
  shootingStarAt,
  shown,
  SKY,
  SKY_SHAPE,
  SKY_SPANS,
  SKY_VISITS,
  type SkyPalette,
  type SkySpan,
  type SkyVisit,
  skyStops,
  starGroups,
  wingAt,
} from "../line/kit";
import { useAppearancePreferences, useContentTopInset, useHomeSidebar } from "../upstream/home";
import { useStageRoom } from "./pillPlace";
import { HomeInFront, useMoonPhase } from "./state";
import { useHeadStyle } from "./head";
import { subscribeSkyAnchor, useSkyAnchor } from "./skyAnchor";
import { fallen } from "./useSky";

/** Where the sun and moon stand until the folder's place is read: clear of the bar's buttons, in its row. */
const BODY_FROM_RIGHT = 128;
const BODY_LEAST_ACROSS = 0.55;
const BODY_OVER_BAR_FOOT = 26;

type Point = { readonly x: number; readonly y: number };
/** How far down the header the stars reach, of the bar's foot. */
const STARS_REACH = 0.92;
const { r: R, sinks: SINKS, rises: RISES, halo: HALO } = SKY_SHAPE.body;

/**
 * The sky, from the screen's top to just past the first row's, where the bar's content lies over
 * the stages' lists. Android's bar stands in flow over the body, so there it draws none.
 */
export function Sky(props: { readonly night: boolean }) {
  const top = useContentTopInset();
  const sidebar = useHomeSidebar();
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const { themeAppearance } = useAppearancePreferences();
  const lifted = useHeadStyle();
  const room = useStageRoom();
  const { frame, at, read } = useBehindTheFolder();
  if (top === 0) return null;
  // The sidebar's width is its own: it draws once measured.
  const width = measured ?? (sidebar ? null : window.width);
  const height = top + room + SKY_SHAPE.tail;
  return (
    <View
      ref={frame}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: 0, right: 0, top: 0, height }}
      onLayout={({ nativeEvent }) => {
        setMeasured(nativeEvent.layout.width);
        read();
      }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, lifted]}>
        {width === null ? null : (
          <Heavens
            width={width}
            height={height}
            top={top}
            body={at}
            night={props.night}
            palette={SKY[themeAppearance === "light" ? "light" : "dark"]}
          />
        )}
      </Animated.View>
    </View>
  );
}

/**
 * Where the folder button stands over the sky (`skyAnchor.ts`), read from both views in the
 * window. The frame is the sky's unlifted place, so a scrolled header reads the same. UIKit
 * places the bar's items on its own, unseen by React, so it reads again once the screen is idle.
 */
function useBehindTheFolder() {
  const frame = useRef<ViewInstance>(null);
  const anchor = useSkyAnchor();
  const inFront = use(HomeInFront);
  const [at, setAt] = useState<Point | null>(null);
  const read = () => {
    const sky = frame.current;
    const folder = anchor;
    if (sky === null || folder === null) {
      setAt(null);
      return;
    }
    sky.measureInWindow((skyX, skyY) =>
      folder.measureInWindow((x, y, width, height) => {
        if (width === 0) return;
        const next = { x: x + width / 2 - skyX, y: y + height / 2 - skyY };
        setAt((before) => (before?.x === next.x && before.y === next.y ? before : next));
      }),
    );
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the folder's place in the native header while the home is in front: now, once idle, and whenever the button is laid out again.
  useEffect(() => {
    if (!inFront) return;
    read();
    const settled = requestIdleCallback(read, { timeout: 1_000 });
    const unsubscribe = subscribeSkyAnchor(read);
    return () => {
      cancelIdleCallback(settled);
      unsubscribe();
    };
  }, [inFront, read]);
  return { frame, at, read };
}

const Heavens = memo(function Heavens(props: {
  readonly width: number;
  readonly height: number;
  /** The bar's foot. */
  readonly top: number;
  /** Where the folder button stands, its middle; the sun and the moon stand behind it. */
  readonly body: Point | null;
  readonly night: boolean;
  readonly palette: SkyPalette;
}) {
  const { width, height, top, palette } = props;
  const behind =
    props.body !== null && props.body.x > R && props.body.x < width - R && props.body.y > 0
      ? props.body
      : null;
  const x = behind?.x ?? Math.max(width * BODY_LEAST_ACROSS, width - BODY_FROM_RIGHT);
  const y = behind?.y ?? top - BODY_OVER_BAR_FOOT;
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
      <Fades span={SKY_SPANS.sunGoes} out style={fill}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="haze" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={palette.haze.colour} stopOpacity={palette.haze.alpha} />
              <Stop offset={1} stopColor={palette.haze.colour} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={x} cy={y} rx={width * 0.7} ry={top * 1.2} fill="url(#haze)" />
        </Svg>
      </Fades>
      <Fades span={SKY_SPANS.cloudsGo} out style={fill}>
        <Clouds
          id="clouds"
          width={width}
          reach={top}
          colour={palette.cloud.colour}
          alpha={palette.cloud.alpha}
        />
      </Fades>
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
      <Visits night={props.night} width={width} reach={reach} palette={palette} />
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

/** Two soft clouds, each a few lobes. */
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
      {CLOUDS.flatMap((cloud) =>
        cloud.lobes.map((lobe) => (
          <Ellipse
            key={`${cloud.x}:${lobe.dx}`}
            cx={cloud.x * props.width + lobe.dx}
            cy={cloud.y * props.reach + lobe.dy}
            rx={lobe.rx}
            ry={lobe.ry}
            fill={`url(#${props.id})`}
          />
        )),
      )}
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

/** The sun: it dips a little as it goes, before the moon comes. */
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
    </Animated.View>
  );
}

/** The moon at tonight's phase, rising into place as the sun goes. */
function Moon(props: { readonly x: number; readonly y: number; readonly palette: SkyPalette }) {
  const phase = useMoonPhase();
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

/**
 * Now and then a visitor crosses the sky (`SKY_VISITS`): a shooting star by night, a seed or
 * birds by day, each fading with its own sky. Only while the home is in front and the app active,
 * never under Reduce Motion; between visits nothing runs but the next one's timer.
 */
function Visits(props: {
  readonly night: boolean;
  readonly width: number;
  readonly reach: number;
  readonly palette: SkyPalette;
}) {
  const { night, width } = props;
  const inFront = use(HomeInFront);
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const [visit, setVisit] = useState<(SkyVisit & { readonly n: number }) | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Schedule visitors while the home is in front and the app active, and clear the timer and AppState listener when that ends.
  useEffect(() => {
    if (!inFront || reduced) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    let n = 0;
    const arm = () => {
      clearTimeout(timer);
      if (AppState.currentState !== "active") return;
      const next = nextVisit(night, first, Math.random);
      first = false;
      timer = setTimeout(() => {
        n += 1;
        setVisit({ ...next, n });
        t.set(0);
        t.set(withTiming(1, { duration: SKY_VISITS.ms[next.kind], easing: Easing.linear }));
        arm();
      }, next.wait);
    };
    arm();
    const listening = AppState.addEventListener("change", arm);
    return () => {
      clearTimeout(timer);
      listening.remove();
    };
  }, [inFront, reduced, night, t]);
  if (visit === null) return null;
  const fill = { position: "absolute", left: 0, top: 0, width, height: props.reach } as const;
  const from = { x: visit.x * width, y: visit.y * props.reach };
  return visit.kind === "shootingStar" ? (
    <Fades span={SKY_SPANS.stars[0]} style={fill}>
      <ShootingStar
        key={visit.n}
        t={t}
        from={from}
        width={width}
        reach={props.reach}
        colour={props.palette.star}
      />
    </Fades>
  ) : (
    <Fades span={SKY_SPANS.cloudsGo} out style={fill}>
      {visit.kind === "seed" ? (
        <Seed key={visit.n} t={t} from={from} width={width} palette={props.palette} />
      ) : (
        <Birds key={visit.n} t={t} from={from} width={width} palette={props.palette} />
      )}
    </Fades>
  );
}

function ShootingStar(props: {
  readonly t: SharedValue<number>;
  readonly from: Point;
  readonly width: number;
  readonly reach: number;
  readonly colour: string;
}) {
  const { t, from, width, reach } = props;
  const flies = useAnimatedStyle(() => {
    const pose = shootingStarAt(t.get(), width, reach);
    return {
      opacity: pose.opacity,
      transform: [
        { translateX: from.x + pose.x },
        { translateY: from.y + pose.y },
        { rotate: `${pose.rotate}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: "absolute", width: 70, height: 1.5 }, flies]}>
      <Svg width={70} height={1.5}>
        <Defs>
          <LinearGradient id="tail" x1="0" y1="0" x2="1" y2="0">
            <Stop offset={0} stopColor={props.colour} stopOpacity={0} />
            <Stop offset={1} stopColor={props.colour} stopOpacity={0.9} />
          </LinearGradient>
        </Defs>
        <Rect width={70} height={1.5} rx={0.75} fill="url(#tail)" />
      </Svg>
    </Animated.View>
  );
}

function Seed(props: {
  readonly t: SharedValue<number>;
  readonly from: Point;
  readonly width: number;
  readonly palette: SkyPalette;
}) {
  const { t, from, width } = props;
  const drifts = useAnimatedStyle(() => {
    const pose = seedAt(t.get(), width);
    return {
      opacity: pose.opacity,
      transform: [
        { translateX: from.x + pose.x },
        { translateY: from.y + pose.y },
        { rotate: `${pose.rotate}deg` },
      ],
    };
  });
  const { colour, alpha } = props.palette.seed;
  return (
    <Animated.View style={[{ position: "absolute", width: 16, height: 22 }, drifts]}>
      <Svg width={16} height={22} viewBox="0 0 16 22">
        {SEED.filaments.map((end) => (
          <Path
            key={`${end.x}:${end.y}`}
            d={`M${SEED.heart.x} ${SEED.heart.y} L${end.x} ${end.y}`}
            stroke={colour}
            strokeOpacity={alpha}
            strokeWidth={0.5}
            strokeLinecap="round"
          />
        ))}
        {SEED.filaments.map((end) => (
          <Circle
            key={`${end.x}:${end.y}:tip`}
            cx={end.x}
            cy={end.y}
            r={0.55}
            fill={colour}
            fillOpacity={alpha}
          />
        ))}
        <Path
          d={`M${SEED.heart.x} ${SEED.stalk.from} L${SEED.heart.x} ${SEED.stalk.to}`}
          stroke={colour}
          strokeOpacity={alpha}
          strokeWidth={0.6}
          strokeLinecap="round"
        />
        <Ellipse
          cx={SEED.heart.x}
          cy={SEED.seed.y}
          rx={SEED.seed.rx}
          ry={SEED.seed.ry}
          fill={colour}
          fillOpacity={alpha}
        />
      </Svg>
    </Animated.View>
  );
}

function Birds(props: {
  readonly t: SharedValue<number>;
  readonly from: Point;
  readonly width: number;
  readonly palette: SkyPalette;
}) {
  const { t, from, width } = props;
  const glides = useAnimatedStyle(() => {
    const pose = birdsAt(t.get(), width);
    return {
      opacity: pose.opacity,
      transform: [{ translateX: from.x + pose.x }, { translateY: from.y + pose.y }],
    };
  });
  return (
    <Animated.View style={[{ position: "absolute" }, glides]}>
      {BIRDS.map((bird, n) => (
        <Bird key={bird.dx} t={t} n={n} bird={bird} palette={props.palette} />
      ))}
    </Animated.View>
  );
}

function Bird(props: {
  readonly t: SharedValue<number>;
  readonly n: number;
  readonly bird: (typeof BIRDS)[number];
  readonly palette: SkyPalette;
}) {
  const { t, n, bird } = props;
  const beats = useAnimatedStyle(() => ({
    transform: [{ scaleY: wingAt(t.get(), n, SKY_VISITS.ms.birds) }],
  }));
  const { colour, alpha } = props.palette.birds;
  const size = { width: 10 * bird.size, height: 4 * bird.size };
  return (
    <Animated.View
      style={[
        { position: "absolute", left: bird.dx, top: bird.dy, transformOrigin: "50% 85%" },
        size,
        beats,
      ]}
    >
      <Svg {...size} viewBox="0 0 10 4">
        <Path
          d={BIRD_PATH}
          fill="none"
          stroke={colour}
          strokeOpacity={alpha}
          strokeWidth={1.3 / bird.size}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}
