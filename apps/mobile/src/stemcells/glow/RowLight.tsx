// A flying Cell's row light (`Wave.tsx`, stemcells/tasks/awake-asleep.md): a lamp round the Cell
// in its provider's tone and the band crossing it, the sense of work going on; an entering row's
// bloom wears the lamp alone. Its status icon says what it does or needs.

import { use } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { useDriverOf } from "../cell/ThreadCell";
import { HomeInFront } from "../home/state";
import { TONES } from "../tokens";
import type { EnvironmentThreadShell } from "../upstream/cells";
import { rgbOf } from "./colour";
import { toneTokenOf } from "./kit";
import { Wave } from "./Wave";

/** A Cell taking off lights its row; a landing lets the light come to rest, as the band's end. */
const LIGHTS = FadeIn.duration(200);
const COMES_TO_REST = FadeOut.duration(400);

export function RowLight(props: {
  readonly thread: EnvironmentThreadShell;
  /** The band crossing on the beat: while the Cell flies. */
  readonly band: boolean;
  /** Where it lies over the row, and the Cell's middle from the row's left. */
  readonly fill: ViewStyle;
  readonly anchorX: number;
}) {
  const inFront = use(HomeInFront);
  const provider = TONES[toneTokenOf(useDriverOf(props.thread))] ?? TONES["--sc-accent"];
  const tone = rgbOf(provider)!;
  const glass = rgbOf(useResolveClassNames("bg-grouped-card").backgroundColor) ?? [0, 0, 0];
  const ink = rgbOf(useResolveClassNames("text-foreground").color) ?? [255, 255, 255];
  return (
    <Animated.View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      entering={LIGHTS}
      exiting={COMES_TO_REST}
    >
      <Wave
        tone={tone}
        glass={glass}
        ink={ink}
        anchorX={props.anchorX}
        fill={props.fill}
        inSight={inFront}
        band={props.band}
        glow
      />
    </Animated.View>
  );
}
