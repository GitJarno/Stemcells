// A Cell in its card on the home, left of what its chat is about, its name under it; a settled
// chat's slim row has it asleep, and Aski's own chat has Aski. A card is two lines at most: the
// pull request and the agent's mark stand under the time, beside the title's second line. T3's
// row hands control here at its seam (`features/threads/thread-list-v2-items.tsx`, `seams.md`).

import { type ReactNode, use, useEffect, useRef } from "react";
import { Pressable, View, type ViewInstance, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { useIsAskiChat } from "../aski/useAskiChat";
import { formingFrom } from "../cell/forming";
import { cellNameOf, clockSeconds } from "../cell/kit";
import { ThreadCell } from "../cell/ThreadCell";
import {
  AppText,
  type EnvironmentThreadShell,
  ProviderIcon,
  PullRequestGlyph,
  pullRequestStatus,
  SymbolView,
  type ThreadPrPresentation,
} from "../upstream/cells";
import { ENVIRONMENT_MACHINE_SYMBOLS, type EnvironmentMachineKind } from "../upstream/home";
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

/** What a card shows in its bottom right: its machine, its pull request and its agent. */
export interface CardMarks {
  readonly machine: EnvironmentMachineKind | null;
  readonly machineLabel: string | null;
  readonly pr: ThreadPrPresentation | null;
  readonly prLabel: string | null;
  readonly onOpenPullRequests: () => void;
  readonly provider: string | null;
  readonly providerIconUrl: string | null | undefined;
}

/** A card row's content with its Cell beside it, and its marks in its bottom right. */
export function CellBesideRow(props: {
  readonly thread: EnvironmentThreadShell;
  readonly marks: CardMarks;
  readonly children: ReactNode;
}) {
  const aski = useIsAskiChat(props.thread.id);
  const { machine, pr, provider } = props.marks;
  return (
    <View className="flex-row items-stretch gap-3">
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
      <View className="min-w-0 flex-1">
        {props.children}
        <View className="absolute bottom-0.5 right-0 flex-row items-center gap-1.5">
          {machine ? (
            <SymbolView
              accessibilityLabel={props.marks.machineLabel ?? undefined}
              name={ENVIRONMENT_MACHINE_SYMBOLS[machine]}
              size={MARK}
              tintColorClassName="accent-icon-muted"
              type="monochrome"
            />
          ) : null}
          {pr ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={props.marks.prLabel ?? undefined}
              hitSlop={10}
              onPress={props.marks.onOpenPullRequests}
              // The row's long-press menu must not also open the pull request on release.
              onLongPress={() => undefined}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <SymbolView name={glyphOf(pr)} size={MARK} tintColorClassName={tintOf(pr)} />
            </Pressable>
          ) : null}
          {provider ? (
            <ProviderIcon
              provider={provider}
              iconUrl={props.marks.providerIconUrl}
              size={AGENT_MARK}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const MARK = 12;
const AGENT_MARK = 14;
const MARK_GAP = 6;

function glyphOf(pr: ThreadPrPresentation) {
  if (pr.kind === "stack") return PullRequestGlyph.stack;
  if (pr.state === null) return PullRequestGlyph.pullRequest;
  return pullRequestStatus({ state: pr.state, isDraft: pr.isDraft }).icon;
}

/** T3's colours for a pull request's state, as its row's badge has them. */
function tintOf(pr: ThreadPrPresentation) {
  if (pr.state === null || pr.isDraft) return "accent-icon-muted";
  if (pr.state === "open") return "accent-adaptive-emerald-600-400";
  if (pr.state === "closed") return "accent-adaptive-rose-600-400";
  return "accent-adaptive-violet-600-400";
}

/** The width the marks take: each mark is a fixed size, so the title knows it before layout. */
function marksWidth(marks: CardMarks) {
  const widths = [
    marks.machine ? MARK : 0,
    marks.pr ? MARK : 0,
    marks.provider ? AGENT_MARK : 0,
  ].filter((width) => width > 0);
  return widths.reduce((sum, width) => sum + width, 0) + MARK_GAP * Math.max(widths.length - 1, 0);
}

const NOTHING: ViewStyle = {};
const HIDDEN: ViewStyle = { display: "none" };

/**
 * How T3's card lays out beside a Cell, two lines at most: the time keeps the width of the marks
 * under it, so the title's second line never runs beneath them. A failed chat's error takes the
 * second line, and the title one.
 */
export function cardLines(beside: boolean, error: boolean, marks: CardMarks) {
  if (!beside) return { beside, titleLines: 2, trailing: NOTHING, meta: NOTHING };
  const width = marksWidth(marks);
  return {
    beside,
    titleLines: error ? 1 : 2,
    trailing: { minWidth: width, justifyContent: "flex-end" } satisfies ViewStyle,
    meta: error ? { paddingRight: width + MARK_GAP } : HIDDEN,
  };
}

/** A slim row's Cell; none in the iPad's sidebar, whose rows stay T3's. */
export function SlimRowCell(props: {
  readonly thread: EnvironmentThreadShell;
  readonly sidebar: boolean;
}) {
  return props.sidebar ? null : <Figure thread={props.thread} points={2} />;
}
