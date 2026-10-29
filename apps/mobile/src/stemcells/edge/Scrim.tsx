// An edge of the screen fading into its ground where content scrolls under the header or the
// composer, where the page can't blur (`Veil.tsx`; stemcells/tasks/phone-polish.md, decision 5).
// Eased stops, so no line shows where the fade starts.

import { useState } from "react";
import { type ColorValue, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { scrimStops } from "./stops";

/**
 * A scrim on `edge`. With `solid`, it is that deep plus `fade`, at the edge. Without, it fills
 * its parent, whole but for `fade` at its far side, and reaches `over` past that side.
 * `beyond` carries it past the edge, for a parent that stops short of the screen's.
 */
export function Scrim(props: {
  readonly edge: "top" | "bottom";
  readonly color: ColorValue | undefined;
  readonly fade: number;
  readonly solid?: number;
  readonly over?: number;
  readonly beyond?: number;
}) {
  const beyond = props.beyond ?? 0;
  const fixed = props.solid === undefined ? null : beyond + props.solid + props.fade;
  const [measured, setMeasured] = useState(0);
  const height = fixed ?? measured;
  const far = props.edge === "top" ? "bottom" : "top";
  return (
    <View
      pointerEvents="none"
      onLayout={
        fixed === null ? ({ nativeEvent }) => setMeasured(nativeEvent.layout.height) : undefined
      }
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        [props.edge]: -beyond,
        ...(fixed === null ? { [far]: -(props.over ?? 0) } : { height: fixed }),
      }}
    >
      {height > 0 ? (
        <Svg width="100%" height={height}>
          <Defs>
            <LinearGradient id={`scrim-${props.edge}`} x1="0" y1="0" x2="0" y2="1">
              {scrimStops(props.edge, height, height - props.fade).map((stop) => (
                <Stop
                  key={`${stop.offset}:${stop.opacity}`}
                  offset={stop.offset}
                  stopColor={props.color}
                  stopOpacity={stop.opacity}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={height} fill={`url(#scrim-${props.edge})`} />
        </Svg>
      ) : null}
    </View>
  );
}
