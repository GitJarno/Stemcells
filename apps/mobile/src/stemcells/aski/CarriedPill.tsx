// The Cell a turn to Aski came from, over Aski's composer (stemcells/tasks/aski-side.md,
// decision 4): its creature and name on a small pill, with a × to leave it out.

import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { ASKI_CARRIED } from "../../../../../stemcells/words/aski.ts";
import { ThreadCell } from "../cell/ThreadCell";
import { entering, exiting } from "../home/listMotion";
import { useThreadShellsSelected } from "../upstream/cells";
import { AppText, SymbolView } from "../upstream/plans";
import { carry, useCarried } from "./carried";

export function CarriedPill(props: {
  readonly environmentId: string;
  readonly threadId: string;
  readonly maxWidth?: number | undefined;
}) {
  const aski = { environmentId: props.environmentId, threadId: props.threadId };
  const from = useCarried(aski);
  const cell = useThreadShellsSelected((threads) =>
    from === null
      ? null
      : (threads.find(
          (thread) => thread.environmentId === from.environmentId && thread.id === from.threadId,
        ) ?? null),
  );
  if (cell === null) return null;
  return (
    <Animated.View
      entering={entering()}
      exiting={exiting()}
      pointerEvents="box-none"
      className="w-full self-center px-[12px] pb-1.5"
      style={{ maxWidth: props.maxWidth }}
    >
      {/* Short of the right edge: Aski's button floats there on an upright phone. */}
      <View
        className="flex-row items-center gap-2 self-start rounded-full border border-border bg-card-alt py-1 pl-2.5 pr-1"
        style={{ maxWidth: "72%" }}
      >
        <ThreadCell thread={cell} points={1} />
        <AppText numberOfLines={1} className="shrink text-sm text-foreground-muted">
          {ASKI_CARRIED.about(cell.title)}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ASKI_CARRIED.drop(cell.title)}
          onPress={() => carry(aski, null)}
          hitSlop={10}
          className="size-7 items-center justify-center rounded-full active:bg-border"
        >
          <SymbolView name="xmark" size={11} tintColorClassName="accent-foreground-muted" />
        </Pressable>
      </View>
    </Animated.View>
  );
}
