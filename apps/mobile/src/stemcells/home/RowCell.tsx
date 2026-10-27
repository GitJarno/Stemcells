// A Cell in its card on the home, left of what its chat is about, its name under it; a settled
// chat's slim row has it asleep, and Aski's own chat has Aski. T3's row hands control here at
// its seam (`features/threads/thread-list-v2-items.tsx`, `stemcells/seams.md`).

import { type ReactNode, use, useEffect, useRef } from "react";
import { View, type ViewInstance } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { useIsAskiChat } from "../aski/useAskiChat";
import { formingFrom } from "../cell/forming";
import { cellNameOf, clockSeconds } from "../cell/kit";
import { ThreadCell } from "../cell/ThreadCell";
import { AppText, type EnvironmentThreadShell } from "../upstream/cells";
import { sendCopy } from "./copies";
import { HomeCellsHeld, HomeInFront, useMinute } from "./state";
import { isAway } from "./tabs";

function Figure(props: { readonly thread: EnvironmentThreadShell; readonly points: number }) {
  const { thread } = props;
  const aski = useIsAskiChat(thread.id);
  const now = useMinute();
  const ink = useResolveClassNames("text-foreground").color;
  const card = useResolveClassNames("bg-grouped-card").backgroundColor;
  const reduced = useReducedMotion();
  const inFront = use(HomeInFront);
  const held = use(HomeCellsHeld);
  const box = useRef<ViewInstance>(null);
  // Asked on every draw, not kept: a list row is handed another chat as it scrolls. A Cell about to form here gets its copy of Aski (`copies.ts`).
  const forming =
    aski || reduced || !inFront ? undefined : formingFrom(thread.id, thread.createdAt);
  const sendFor = () => {
    if (forming === undefined || forming <= clockSeconds()) return;
    box.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) sendCopy(thread.id, { x, y, width, height }, forming);
    });
  };
  // A list row is handed another chat as it scrolls, without a new layout.
  // oxlint-disable-next-line t3code/react-effect-budget -- Send a forming Cell's copy of Aski to this row when the row is handed another chat.
  useEffect(sendFor, [thread.id, forming]);
  if (aski) return <AskiFigure height={props.points * 14} ink={ink} ground={card} />;
  return (
    <View ref={box} onLayout={sendFor}>
      <ThreadCell
        thread={thread}
        points={props.points}
        plays
        away={isAway(thread, now)}
        formingFrom={forming}
        held={held}
      />
    </View>
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
