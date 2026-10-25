// A Cell's character on the phone, as the Mac draws it (`apps/web/src/
// stemcells/cell/CellFigure.tsx`): the kit's art in its provider's colours,
// wearing what it was dealt, its face from its mood, the "?" over it while
// it waits on you. Held still it only blinks; playing, it acts out its
// scene on the sprite clock. Its box is the miniature's (13 × 14 cells),
// hats and all, so every Cell stands on the same line; its picture reaches
// past the box by the margin, taking no room.

import { useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import Animated, { useReducedMotion, ZoomIn, ZoomOut } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { CODE_FONT, NEEDS_YOU, NOTCH } from "../tokens";
import { never, now, onBeat } from "./clock";
import { useComposed } from "./compose";
import { drawFrame } from "./figure";
import {
  type Activity,
  asksYou,
  bodyOf,
  BOX,
  type CellScene,
  frameShown,
  type Ground,
  isBlinking,
  MARGIN,
  type MiniFrame,
  type Mood,
  sceneFor,
  wornLook,
} from "./kit";

/** The frame a Cell shows at `seconds`: playing, its scene's; held, the first, its eyes shut while it blinks. */
function frameAt(
  scene: CellScene,
  name: string,
  seconds: number | undefined,
  plays: boolean,
  pleading: boolean,
): MiniFrame {
  if (plays || seconds === undefined) return frameShown(scene, name, seconds, pleading);
  const shut = scene.shut !== undefined && isBlinking(name, seconds, pleading);
  return (shut ? scene.shut! : scene).mini[0]!;
}

export function CellFigure(props: {
  /** Its chat's thread id: what it is called, when it blinks, what it wears when dealt alone. */
  readonly name: string;
  readonly mood: Mood;
  readonly activity?: Activity | undefined;
  /** Its provider's driver (`claudeAgent`, `codex`, …), whose colours it wears. */
  readonly provider?: string | null | undefined;
  /** What it was dealt with the others in view (`roster.ts`); bare until then. */
  readonly look?: readonly string[] | undefined;
  /** Points a cell of the miniature is drawn. */
  readonly points?: number | undefined;
  /** Acts out its scene; held still, it only blinks. */
  readonly plays?: boolean | undefined;
  readonly ground?: Ground | undefined;
}) {
  const points = props.points ?? 2;
  const { name, mood, activity } = props;
  const worn = (props.look ?? []).join("+");
  const plays = props.plays ?? false;
  const pleading = asksYou(mood);
  const reduced = useReducedMotion();
  const look = wornLook(worn === "" ? [] : worn.split("+"));
  const ready = useComposed(`${worn}|${mood}|${activity ?? ""}`, () => {
    sceneFor(look, mood, activity, 0);
  });
  const frame = useSyncExternalStore(ready && !reduced ? onBeat : never, () => {
    if (!ready) return null;
    const seconds = reduced ? undefined : now();
    return frameAt(
      sceneFor(look, mood, activity, plays ? (seconds ?? 0) : 0),
      name,
      seconds,
      plays,
      pleading,
    );
  });
  const drawing =
    frame === null ? null : drawFrame(frame, bodyOf(props.provider), props.ground ?? "black");
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
          style={{ position: "absolute", left: -MARGIN.x * points, top: -MARGIN.y * points }}
        >
          {drawing.inks.map((ink) => (
            <Path
              key={`${ink.fill}${ink.opacity}`}
              d={ink.d}
              fill={ink.fill}
              fillOpacity={ink.opacity}
            />
          ))}
        </Svg>
      )}
      {pleading ? <AskMark points={points} /> : null}
    </View>
  );
}

/** The "?" over a Cell that waits on you, off its top corner, measured in its pixels. */
function AskMark(props: { readonly points: number }) {
  const pixel = props.points;
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(14)}
      exiting={ZoomOut.duration(160)}
      style={{
        position: "absolute",
        top: pixel * -3,
        right: pixel * -2.5,
        paddingHorizontal: pixel * 1.6,
        paddingVertical: pixel * 0.4,
        borderRadius: pixel * 1.8,
        backgroundColor: NEEDS_YOU,
        shadowColor: NEEDS_YOU,
        shadowOpacity: 0.55,
        shadowRadius: pixel * 2.5,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Text
        allowFontScaling={false}
        style={{
          color: NOTCH,
          fontFamily: CODE_FONT,
          fontWeight: "800",
          fontSize: pixel * 5.5,
          lineHeight: pixel * 6.5,
        }}
      >
        ?
      </Text>
    </Animated.View>
  );
}
