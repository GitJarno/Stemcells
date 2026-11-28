// The night behind the home's header over Asleep, and nothing over Input and Awake
// (stemcells/tasks/day-night.md). Drawn once, in layers whose opacity and place alone follow the
// one progress (`useSky.ts`), on the UI thread; while it stands, nothing moves but a rare shooting
// star. It goes up and out with the title as the list in front scrolls (`head.ts`).

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
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import {
  litPath,
  nextVisit,
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
} from "../line/kit";
import { useAppearancePreferences, useContentTopInset, useHomeSidebar } from "../upstream/home";
import { useStageRoom } from "./pillPlace";
import { HomeInFront, useMoonPhase } from "./state";
import { useHeadStyle } from "./head";
import { subscribeSkyAnchor, useSkyAnchor } from "./skyAnchor";
import { fallen } from "./useSky";

/** Where the moon stands until the folder's place is read: clear of the bar's buttons, in its row. */
const BODY_FROM_RIGHT = 128;
const BODY_LEAST_ACROSS = 0.55;
const BODY_OVER_BAR_FOOT = 26;

type Point = { readonly x: number; readonly y: number };
/** How far down the header the stars reach, of the bar's foot. */
const STARS_REACH = 0.92;
const { r: R, rises: RISES, halo: HALO } = SKY_SHAPE.body;

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
  /** Where the folder button stands, its middle; the moon stands behind it. */
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
      <Fades span={SKY_SPANS.nightDeepens} style={fill}>
        <Gradient id="night" width={width} height={height} stops={skyStops(palette.night, whole)} />
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
      <ShootingStars night={props.night} width={width} reach={reach} palette={palette} />
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

/** A layer coming in over `span` of the turn. */
function Fades(props: {
  readonly span: SkySpan;
  readonly style: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const { span } = props;
  const fades = useAnimatedStyle(() => ({ opacity: shown(fallen.get(), span) }));
  return <Animated.View style={[props.style, fades]}>{props.children}</Animated.View>;
}

const boxAt = (x: number, y: number) =>
  ({
    position: "absolute",
    left: x - HALO * R,
    top: y - HALO * R,
    width: 2 * HALO * R,
    height: 2 * HALO * R,
  }) as const;

/** The moon at tonight's phase, rising into place as night falls. */
function Moon(props: { readonly x: number; readonly y: number; readonly palette: SkyPalette }) {
  const phase = useMoonPhase();
  const reduced = useReducedMotion();
  const rises = useAnimatedStyle(() => {
    const p = fallen.get();
    return {
      opacity: shown(p, SKY_SPANS.moonComes),
      // Under Reduce Motion nothing moves: the moon only fades where it stands.
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
 * Now and then a shooting star crosses the night (`SKY_VISITS`), fading with the stars, so a turn
 * takes one in flight away. Only by night, while the home is in front and the app active, never
 * under Reduce Motion; between them nothing runs but the next one's timer.
 */
function ShootingStars(props: {
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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Schedule shooting stars by night while the home is in front and the app active, and clear the timer and AppState listener when that ends.
  useEffect(() => {
    if (!night || !inFront || reduced) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    let n = 0;
    const arm = () => {
      clearTimeout(timer);
      if (AppState.currentState !== "active") return;
      const next = nextVisit(first, Math.random);
      first = false;
      timer = setTimeout(() => {
        n += 1;
        setVisit({ ...next, n });
        t.set(0);
        t.set(withTiming(1, { duration: SKY_VISITS.ms, easing: Easing.linear }));
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
  return (
    <Fades span={SKY_SPANS.stars[0]} style={fill}>
      <ShootingStar
        key={visit.n}
        t={t}
        from={{ x: visit.x * width, y: visit.y * props.reach }}
        width={width}
        reach={props.reach}
        colour={props.palette.star}
      />
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
