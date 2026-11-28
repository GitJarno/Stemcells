// The wordmark, `stemcells`: Outfit's outlines from `stemcells/brand`, the
// web's sidebar wordmark from the same path, in the place's own colour.
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

import { WORDMARK, WORDMARK_VIEW_BOX } from "../../../../../stemcells/brand/mark.ts";

const ThemedPath = withUniwind(Path);

const [, , boxWidth, boxHeight] = WORDMARK_VIEW_BOX.split(" ").map(Number) as [
  number,
  number,
  number,
  number,
];

export function Wordmark(props: { readonly height: number; readonly colorClassName?: string }) {
  return (
    <Svg
      height={props.height}
      width={(props.height * boxWidth) / boxHeight}
      viewBox={WORDMARK_VIEW_BOX}
    >
      <ThemedPath
        d={WORDMARK}
        colorClassName={props.colorClassName ?? "accent-foreground"}
        fill="currentColor"
      />
    </Svg>
  );
}
