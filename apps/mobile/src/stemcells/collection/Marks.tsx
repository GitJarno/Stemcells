// One Cell's record on the phone, as the Mac's (`apps/web/src/stemcells/collection/
// Wardrobe.tsx`): every mark a life can earn, the earned ones with what shows them and when.

import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import { AppText } from "../upstream/disk";
import {
  type Award,
  evidenceOf,
  MARK_GLYPH_PATHS,
  MARK_GLYPH_SIDE,
  MARK_NAMES,
  MARK_TAKES,
  type MarkId,
  MARKS,
  marksCount,
  marksOf,
} from "./kit";
import { dateOf, NUMBERS } from "./parts";

const GLYPH = 14;

/** A mark's glyph in the words' own ink, faint until earned. */
function MarkGlyph(props: { readonly mark: MarkId; readonly earned: boolean }) {
  const ink = useResolveClassNames(
    props.earned ? "text-foreground" : "text-foreground-muted",
  ).color;
  return (
    <Svg
      width={GLYPH}
      height={GLYPH}
      viewBox={`0 0 ${MARK_GLYPH_SIDE} ${MARK_GLYPH_SIDE}`}
      style={{ marginTop: 2, opacity: props.earned ? 1 : 0.4 }}
    >
      <Path d={MARK_GLYPH_PATHS[props.mark]} fill={ink} />
    </Svg>
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
      <View className="gap-2.5">
        {MARKS.map((mark) => {
          const award = earned.get(mark);
          return (
            <View key={mark} accessible className="flex-row items-start gap-2.5">
              <MarkGlyph mark={mark} earned={award !== undefined} />
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
