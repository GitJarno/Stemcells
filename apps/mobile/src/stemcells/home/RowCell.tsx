// A Cell in its card on the home, as the original app's cards had their critters:
// it stands left of what its chat is about, its name under it; a settled
// chat's slim row has it too, asleep. Aski's own chat, when the list shows
// it, has Aski. T3's row hands control here at its seam
// (`features/threads/thread-list-v2-items.tsx`, `stemcells/seams.md`).

import type { ReactNode } from "react";
import { View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { useIsAskiChat } from "../aski/useAskiChat";
import { cellNameOf } from "../cell/kit";
import { ThreadCell } from "../cell/ThreadCell";
import { AppText, type EnvironmentThreadShell } from "../upstream/cells";
import { useMinute } from "./state";
import { isAway } from "./tabs";

function Figure(props: { readonly thread: EnvironmentThreadShell; readonly points: number }) {
  const aski = useIsAskiChat(props.thread.id);
  const now = useMinute();
  const ink = useResolveClassNames("text-foreground").color;
  const card = useResolveClassNames("bg-grouped-card").backgroundColor;
  if (aski) return <AskiFigure height={props.points * 14} ink={ink} ground={card} />;
  return (
    <ThreadCell
      thread={props.thread}
      points={props.points}
      plays
      away={isAway(props.thread, now)}
    />
  );
}

/** A card row's content with its Cell beside it. */
export function CellBesideRow(props: {
  readonly thread: EnvironmentThreadShell;
  readonly children: ReactNode;
}) {
  const aski = useIsAskiChat(props.thread.id);
  return (
    <View className="flex-row items-center gap-3">
      <View className="w-[52px] items-center">
        <Figure thread={props.thread} points={2} />
        <AppText
          className="mt-1.5 text-[10px] text-foreground-muted"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {aski ? "Aski" : cellNameOf(props.thread.id)}
        </AppText>
      </View>
      <View className="min-w-0 flex-1">{props.children}</View>
    </View>
  );
}

/** A slim row's Cell; none in the iPad's sidebar, whose rows stay T3's. */
export function SlimRowCell(props: {
  readonly thread: EnvironmentThreadShell;
  readonly sidebar: boolean;
}) {
  return props.sidebar ? null : <Figure thread={props.thread} points={2} />;
}
