// A Cell held still on the phone: its picture at rest in `look`, or a scene's telling frame,
// drawn once with no clock, as the Mac's (`apps/web/src/stemcells/cell/CellStill.tsx`). A page
// of them costs no frame. It tells the kit nothing of where a Cell stands, so a stand-in's
// name is safe here.

import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import { useComposed } from "../cell/compose";
import { drawFrame } from "../cell/figure";
import { bodyOf, BOX, frameShown, MARGIN, sceneFor, sceneOf, wornLook } from "../cell/kit";
import { useThemeAppearance } from "../upstream/cells";

/** How much of the ink a Cell not yet earned is drawn in, as the Mac's silhouette. */
const FLAT = 0.28;

export function CellStill(props: {
  readonly name: string;
  readonly look: readonly string[];
  readonly provider?: string | null | undefined;
  /** Points a cell of the miniature is drawn. */
  readonly points: number;
  /** A scene to show the telling frame of (`act/flip`), in place of its rest; an unknown one rests. */
  readonly scene?: string | undefined;
  /** Its shape alone, in one ink: what waits, and no more. */
  readonly flat?: boolean | undefined;
}) {
  const { name, points, scene } = props;
  const worn = props.look.join("+");
  const ground = useThemeAppearance() === "light" ? "light" : "black";
  const ink = useResolveClassNames("text-foreground").color;
  const frame = () => {
    const look = wornLook(worn === "" ? [] : worn.split("+"));
    const act = scene === undefined ? undefined : sceneOf(look, scene);
    return (
      act?.mini[act.tell] ??
      frameShown(sceneFor(look, "awake", undefined, 0), name, undefined, false)
    );
  };
  const ready = useComposed(`collection:${worn}|${scene ?? ""}`, frame);
  const drawing = ready ? drawFrame(frame(), bodyOf(props.provider), ground) : null;
  const cell = points / 2;
  return (
    <View
      pointerEvents="none"
      style={{ width: BOX.width * points, height: BOX.height * points }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {drawing === null ? null : (
        <Svg
          width={drawing.width * cell}
          height={drawing.height * cell}
          viewBox={`0 0 ${drawing.width} ${drawing.height}`}
          style={{
            position: "absolute",
            left: -MARGIN.x * points,
            top: -MARGIN.y * points,
            opacity: props.flat === true ? FLAT : 1,
          }}
        >
          {drawing.inks.map((each) => (
            <Path
              key={`${each.fill}${each.opacity}`}
              d={each.d}
              fill={props.flat === true ? ink : each.fill}
              fillOpacity={each.opacity}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}
