// An awake Cell's row light (`Wave.tsx`, stemcells/tasks/awake-asleep.md): a lamp round the Cell
// in its provider's tone, the band crossing it only while it flies; none once its landing has
// been seen. Its status icon says what it does or needs.

import { use } from "react";
import type { ViewStyle } from "react-native";
import { useResolveClassNames } from "uniwind";

import { useDriverOf } from "../cell/ThreadCell";
import { HomeInFront } from "../home/state";
import type { RowLight as Light } from "../line/kit";
import { TONES } from "../tokens";
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
  if (!light.lit) return null;
  return <Lit {...props} />;
}

function Lit(props: Parameters<typeof RowLight>[0]) {
  const { light } = props;
  const inFront = use(HomeInFront);
  const provider = TONES[toneTokenOf(useDriverOf(props.thread))] ?? TONES["--sc-accent"];
  const tone = rgbOf(provider)!;
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
      glow
    />
  );
}
