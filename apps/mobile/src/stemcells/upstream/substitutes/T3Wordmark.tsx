// Replaces `components/T3Wordmark.tsx` (`substitutes.cjs`). Where upstream
// draws T3's wordmark as an icon (the work log's rows for T3's own tools), the
// phone draws Stemcells' mark, SC█, at the same height and in the same colour:
// the web's glyph, from the same paths.
import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

import {
  MARK_CURSOR,
  MARK_LETTERS,
  MARK_VIEW_BOX,
} from "../../../../../../stemcells/brand/mark.ts";

const ThemedPath = withUniwind(Path);

const [, , boxWidth, boxHeight] = MARK_VIEW_BOX.split(" ").map(Number) as [
  number,
  number,
  number,
  number,
];

export function T3Wordmark(props: {
  readonly height: number;
  readonly color?: ColorValue;
  readonly colorClassName?: string;
}) {
  return (
    <Svg
      accessibilityLabel="Stemcells"
      height={props.height}
      width={(props.height * boxWidth) / boxHeight}
      viewBox={MARK_VIEW_BOX}
    >
      <ThemedPath
        d={MARK_LETTERS}
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
      <ThemedPath
        d={MARK_CURSOR}
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
    </Svg>
  );
}
