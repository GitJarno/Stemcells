// An awake Cell's row light (`Wave.tsx`, stemcells/tasks/awake-asleep.md): the wash from the
// row's Cell in its provider's tone, or Input's amber while it asks; the band only while it flies;
// faint once its landing has been seen.

import { use } from "react";
import type { ViewStyle } from "react-native";
import { useResolveClassNames } from "uniwind";

import { useDriverOf } from "../cell/ThreadCell";
import { HomeInFront } from "../home/state";
import type { RowLight as Light } from "../line/kit";
import { NEEDS_YOU, TONES } from "../tokens";
import type { EnvironmentThreadShell } from "../upstream/cells";
import { rgbOf } from "./colour";
import { toneTokenOf } from "./kit";
import { Wave } from "./Wave";

export function RowLight(props: {
  readonly thread: EnvironmentThreadShell;
  readonly light: Light;
  /** Where it lies over the row, and the Cell's middle from the row's left. */
  readonly fill: ViewStyle;
  readonly anchorX: number;
}) {
  const { light } = props;
  const inFront = use(HomeInFront);
  const provider = TONES[toneTokenOf(useDriverOf(props.thread))] ?? TONES["--sc-accent"];
  const tone = rgbOf(light.tone === "input" ? NEEDS_YOU : provider)!;
  const glass = rgbOf(useResolveClassNames("bg-grouped-card").backgroundColor) ?? [0, 0, 0];
  const ink = rgbOf(useResolveClassNames("text-foreground").color) ?? [255, 255, 255];
  return (
    <Wave
      tone={tone}
      glass={glass}
      ink={ink}
      anchorX={props.anchorX}
      fill={props.fill}
      inSight={inFront}
      band={light.band}
      faint={light.strength === "faint"}
    />
  );
}
