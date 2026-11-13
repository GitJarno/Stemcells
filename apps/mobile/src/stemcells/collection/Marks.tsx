// One Cell's record on the phone, as the Mac's (`apps/web/src/stemcells/collection/
// Wardrobe.tsx`): every mark a life can earn, the earned ones with what shows them and when.

import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import { AppText } from "../upstream/disk";
import {
  type Award,
  evidenceOf,
  MARK_ICON_BOX,
  MARK_ICON_STROKE,
  MARK_ICONS,
  MARK_NAMES,
  MARK_TAKES,
  type MarkId,
  MARKS,
  marksCount,
  marksOf,
} from "./kit";
import { dateOf, NUMBERS } from "./parts";

const ICON = 18;

/** A mark's icon on its tile, in the words' own ink: filled in once earned, an outline until then. */
function MarkTile(props: { readonly mark: MarkId; readonly earned: boolean }) {
  const ink = useResolveClassNames(
    props.earned ? "text-foreground" : "text-foreground-muted",
  ).color;
  return (
    <View
      className={`size-8 items-center justify-center rounded-lg ${
        props.earned ? "bg-foreground/8" : "border border-dashed border-border"
      }`}
    >
      <Svg
        width={ICON}
        height={ICON}
        viewBox={`0 0 ${MARK_ICON_BOX} ${MARK_ICON_BOX}`}
        fill="none"
        stroke={ink}
        strokeWidth={MARK_ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={props.earned ? 1 : 0.5}
      >
        {MARK_ICONS[props.mark].map((part) =>
          "d" in part ? (
            <Path key={part.d} d={part.d} />
          ) : (
            <Circle
              key={part.circle.join()}
              cx={part.circle[0]}
              cy={part.circle[1]}
              r={part.circle[2]}
            />
          ),
        )}
      </Svg>
    </View>
  );
}

export function Marks(props: { readonly name: string; readonly awards: readonly Award[] }) {
  const earned = new Map(props.awards.map((award) => [award.mark, award]));
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between gap-2">
        <AppText
          accessibilityRole="header"
          className="shrink text-xs font-t3-medium text-foreground-muted"
          numberOfLines={1}
        >
          {marksOf(props.name)}
        </AppText>
        <AppText className="text-xs text-foreground-muted" style={NUMBERS}>
          {marksCount(earned.size, MARKS.length)}
        </AppText>
      </View>
      <View className="gap-3">
        {MARKS.map((mark) => {
          const award = earned.get(mark);
          return (
            <View key={mark} accessible className="flex-row items-center gap-3">
              <MarkTile mark={mark} earned={award !== undefined} />
              <View className="min-w-0 flex-1">
                <AppText
                  className={
                    award === undefined
                      ? "text-sm text-foreground-muted"
                      : "text-sm font-t3-medium text-foreground"
                  }
                >
                  {MARK_NAMES[mark]}
                </AppText>
                <AppText className="text-xs text-foreground-muted">
                  {award === undefined
                    ? MARK_TAKES[mark]
                    : `${evidenceOf(award)} · ${dateOf(award.at)}`}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
