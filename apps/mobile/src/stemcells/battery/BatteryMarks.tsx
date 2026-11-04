// The charge beside the app's name: a small laptop whose screen is its level, so it can't be read
// as the phone's own battery. Out of reach, its lid shuts. It moves on events only: the fill rises
// once a run and pulses on plugging in and on running low. A tap opens the machines' menu.

import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import { spokenCharge } from "../../../../../stemcells/words/battery.ts";
import { ScopeMenu, useMachinesMenu } from "../home/scope";
import { useAppearancePreferences } from "../upstream/battery";
import { AppText } from "../upstream/cells";
import { fillColour, type MachineBattery, numberColour, numbersFit, zoneOf } from "./marks";
import { useBatteries } from "./useBatteries";

const WIDTH = 24;
const HEIGHT = 17;
const FILL = { left: 4.7, top: 2.45, width: 14.6, height: 9.1 };
const INK_OPACITY = 0.74;
const SHUT_OPACITY = 0.55;
const PLUGGED_OPACITY = 0.34;
const QUIET_NUMBER_OPACITY = 0.8;
const RISE_MS = 600;
const SETTLE_MS = 300;
const PULSE_MS = 210;

/** The machines whose fill has risen this run: a header drawn again doesn't rise again. */
const risen = new Set<string>();

// Views re-hosted in the header blank under a native-driver animation
// (`WorkspaceConnectionTitle.tsx`), so these run on the JS path; one-shots, short.
function useFill(environmentId: string, level: number, zone: string, reduced: boolean) {
  const [width] = useState(() => new Animated.Value(risen.has(environmentId) ? level : 0));
  const [opacity] = useState(() => new Animated.Value(1));
  const lastZone = useRef(zone);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Runs the fill's one-shot rise to a new level and stops it on cleanup.
  useEffect(() => {
    const first = !risen.has(environmentId);
    risen.add(environmentId);
    if (reduced) {
      width.setValue(level);
      return;
    }
    const rise = Animated.timing(width, {
      toValue: level,
      duration: first ? RISE_MS : SETTLE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    rise.start();
    return () => rise.stop();
  }, [environmentId, level, reduced, width]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Runs one pulse when the charge crosses into a new zone and stops it on cleanup.
  useEffect(() => {
    const before = lastZone.current;
    lastZone.current = zone;
    if (before === zone || zone === "fine" || reduced) return;
    const pulse = Animated.sequence([
      Animated.timing(opacity, { toValue: 0.3, duration: PULSE_MS, useNativeDriver: false }),
      Animated.timing(opacity, { toValue: 1, duration: PULSE_MS, useNativeDriver: false }),
    ]);
    pulse.start();
    return () => pulse.stop();
  }, [zone, reduced, opacity]);

  return { width, opacity };
}

function Shut(props: { readonly ink: string }) {
  return (
    <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <Rect
        x={0.6}
        y={10.3}
        width={22.8}
        height={2.5}
        rx={1.1}
        fill={props.ink}
        fillOpacity={SHUT_OPACITY}
      />
      <Rect
        x={0.6}
        y={13.3}
        width={22.8}
        height={2.9}
        rx={1.3}
        fill={props.ink}
        fillOpacity={SHUT_OPACITY}
      />
    </Svg>
  );
}

function Open(props: {
  readonly battery: MachineBattery;
  readonly ink: string;
  readonly ground: string;
}) {
  const { battery, ink, ground } = props;
  const { themeAppearance } = useAppearancePreferences();
  const reduced = useReducedMotion();
  const colour = fillColour(battery, themeAppearance);
  const level = Math.max(1.6, (FILL.width * battery.percent) / 100);
  const { width, opacity } = useFill(battery.environmentId, level, zoneOf(battery), reduced);
  return (
    <>
      <Animated.View
        style={{
          position: "absolute",
          left: FILL.left,
          top: FILL.top,
          height: FILL.height,
          borderRadius: 1.1,
          width,
          opacity: colour === null ? PLUGGED_OPACITY : opacity,
          backgroundColor: colour ?? ink,
        }}
      />
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Rect
          x={3}
          y={0.75}
          width={18}
          height={12.5}
          rx={2.6}
          fill="none"
          stroke={ink}
          strokeOpacity={INK_OPACITY}
          strokeWidth={1.35}
        />
        <Rect
          x={0.6}
          y={14.4}
          width={22.8}
          height={2}
          rx={1}
          fill={ink}
          fillOpacity={INK_OPACITY}
        />
        {battery.power === "charging" ? (
          <Path
            d="M13.1 2.6 8.9 7.8h2.7l-.7 3.6 4.2-5.2h-2.7z"
            fill={ink}
            stroke={ground}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
        ) : null}
        {battery.power === "plugged" ? (
          <Path
            d="M10.2 3.6v1.8M13.8 3.6v1.8M8.9 5.5h6.2v1.3a3.1 3.1 0 0 1-6.2 0zM12 9.9v1.5"
            fill="none"
            stroke={ink}
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </>
  );
}

function Laptop(props: {
  readonly battery: MachineBattery;
  readonly showNumber: boolean;
  readonly ink: string;
  readonly ground: string;
}) {
  const { battery } = props;
  const { themeAppearance } = useAppearancePreferences();
  const coloured = numberColour(battery, themeAppearance);
  return (
    <View className="flex-row items-center gap-1">
      <View style={{ width: WIDTH, height: HEIGHT }}>
        {battery.away ? (
          <Shut ink={props.ink} />
        ) : (
          <Open battery={battery} ink={props.ink} ground={props.ground} />
        )}
      </View>
      {props.showNumber ? (
        <AppText
          allowFontScaling={false}
          className={
            coloured === null && battery.away
              ? "font-t3-medium text-foreground-muted"
              : "font-t3-medium text-foreground"
          }
          style={[
            { fontSize: 13, fontVariant: ["tabular-nums"], letterSpacing: -0.1 },
            coloured === null ? null : { color: coloured },
            coloured === null && !battery.away ? { opacity: QUIET_NUMBER_OPACITY } : null,
          ]}
        >
          {`${battery.percent}%`}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * Every machine with a battery, in `room` points: nothing without one, so a desktop's home is as
 * it was.
 */
export function BatteryMarks(props: { readonly room: number | null }) {
  const batteries = useBatteries();
  const menu = useMachinesMenu();
  const ink = useResolveClassNames("text-foreground").color ?? "#000000";
  const ground = useResolveClassNames("bg-screen").backgroundColor ?? "transparent";
  if (batteries.length === 0) return null;
  const showNumbers = numbersFit(batteries.length, props.room);
  return (
    <View className="ml-2 min-w-0 shrink overflow-hidden">
      <ScopeMenu
        title={menu.title}
        label={batteries
          .map((battery) => spokenCharge(battery.label, battery, battery.away))
          .join(". ")}
        actions={menu.actions}
        onSelect={menu.onSelect}
      >
        <View className="flex-row items-center gap-2">
          {batteries.map((battery) => (
            <Laptop
              key={battery.environmentId}
              battery={battery}
              showNumber={showNumbers}
              ink={String(ink)}
              ground={String(ground)}
            />
          ))}
        </View>
      </ScopeMenu>
    </View>
  );
}
