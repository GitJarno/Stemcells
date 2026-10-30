// A chat's composer while its Cell flies (`Wave.tsx`): the light the Mac's composer wears, in
// place of T3's "Flying 2m 50s" over it (`upstream/substitutes/floating-working-control.tsx`).
// The composer's substitute tells it the chat and whether it's busy; the seam in upstream's
// composer surface lays it between the glass and the field.

import { useIsFocused } from "@react-navigation/native";
import { createContext, use } from "react";
import { useResolveClassNames } from "uniwind";

import { useDriverOf } from "../cell/ThreadCell";
import { TONES } from "../tokens";
import type { EnvironmentThreadShell } from "../upstream/cells";
import { rgbOf } from "./colour";
import { toneTokenOf } from "./kit";
import { Wave } from "./Wave";

export const ComposerFlight = createContext<{
  readonly thread: EnvironmentThreadShell;
  readonly busy: boolean;
} | null>(null);

/** From the composer's leading edge, where its + stands. */
const ANCHOR = 28;
const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

/** The composer's light while its Cell flies; else nothing. */
export function ComposerLight() {
  const flight = use(ComposerFlight);
  return flight?.busy ? <Light thread={flight.thread} /> : null;
}

function Light(props: { readonly thread: EnvironmentThreadShell }) {
  const inSight = useIsFocused();
  const tone = rgbOf(TONES[toneTokenOf(useDriverOf(props.thread))] ?? TONES["--sc-accent"])!;
  const glass = rgbOf(useResolveClassNames("bg-composer-surface").backgroundColor) ?? [0, 0, 0];
  const ink = rgbOf(useResolveClassNames("text-foreground").color) ?? [255, 255, 255];
  return (
    <Wave tone={tone} glass={glass} ink={ink} anchorX={ANCHOR} fill={FILL} inSight={inSight} />
  );
}
