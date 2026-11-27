import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import { ERROR, NEEDS_YOU, TONES } from "../tokens";
import { AppText } from "../upstream/cells";
import { providerNameOf, useNowMinuteMs } from "../upstream/limits";
import { bindingOf, brandTokenOf, type PlanTone, ringFigure } from "./kit";
import { showPlans } from "./sheet";
import { usePlans } from "./usePlans";

const SIZE = 30;
const RADIUS = 11.5;
const CIRCLE = 2 * Math.PI * RADIUS;
const NUMBERS = { fontVariant: ["tabular-nums" as const] };

/** A plan's ink: its provider's colour while there is room, amber when short, red when out. */
export function useInkOf(): (driver: string, tone: PlanTone) => string {
  const dim = useResolveClassNames("text-foreground-muted").color;
  return (driver, tone) => {
    if (tone === "out") return ERROR;
    if (tone === "short") return NEEDS_YOU;
    const token = brandTokenOf(driver);
    return (token === null ? undefined : TONES[token]) ?? String(dim);
  };
}

/**
 * The plan you're on, as the Mac's ring (`apps/web/src/stemcells/rail/PlanRing.tsx`): filled to
 * what its binding window has used, in the provider's colour, amber when the pace runs it out
 * before the reset, red once out; the percent inside, or once out, how long until it frees. A tap
 * opens every plan in a sheet.
 */
export function PlanRing() {
  const now = useNowMinuteMs();
  const { ring } = usePlans(now);
  const inkOf = useInkOf();
  const track = useResolveClassNames("text-foreground").color;
  const binding = ring === null ? null : bindingOf(ring);
  if (ring === null || binding === null) return null;

  const used = ring.tone === "out" ? 100 : 100 - binding.left;
  const figure = ringFigure(ring, now);
  const ink = inkOf(String(ring.account.driver), ring.tone);
  const provider = providerNameOf(String(ring.account.driver));
  const label =
    ring.tone === "out"
      ? `${provider} · ${ring.name}: limited, frees in ${figure}`
      : `${provider} · ${ring.name}: ${used}% used`;
  return (
    <Pressable
      onPress={showPlans}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Shows every plan's limits"
      className="size-9 items-center justify-center"
    >
      <View style={{ width: SIZE, height: SIZE }} className="items-center justify-center">
        <Svg width={SIZE} height={SIZE} viewBox="0 0 28 28" style={StyleSheet.absoluteFill}>
          <Circle
            cx={14}
            cy={14}
            r={RADIUS}
            fill="none"
            stroke={track}
            strokeOpacity={0.24}
            strokeWidth={2.25}
          />
          {used > 0 ? (
            <Circle
              cx={14}
              cy={14}
              r={RADIUS}
              fill="none"
              stroke={ink}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeDasharray={`${(CIRCLE * used) / 100} ${CIRCLE}`}
              transform="rotate(-90 14 14)"
            />
          ) : null}
        </Svg>
        <AppText
          className="font-t3-bold"
          style={[
            NUMBERS,
            { fontSize: 9, lineHeight: 11, letterSpacing: -0.3 },
            ring.tone === "fine" ? null : { color: ink },
          ]}
          allowFontScaling={false}
        >
          {figure}
        </AppText>
      </View>
    </Pressable>
  );
}
