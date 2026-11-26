// A Cell in its card on the home, its name under it (Aski in Aski's chat), its title led by its
// project's mark (`stemcells/tasks/project-first.md`), its machine and pull request under the time.
// On Awake a card is one line, as Asleep's rows are, its light behind it (`awake-asleep.md`).
// T3's row hands control here (`features/threads/thread-list-v2-items.tsx`).

import { type ReactNode, use, useEffect, useRef } from "react";
import { Pressable, View, type ViewInstance, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "../aski/AskiFigure";
import { useIsAskiChat } from "../aski/useAskiChat";
import { formingFrom } from "../cell/forming";
import { BOX, cellNameOf, clockSeconds } from "../cell/kit";
import { ThreadCell } from "../cell/ThreadCell";
import { RowLight } from "../glow/RowLight";
import { ROW_LIGHT, rowStateOf } from "../line/kit";
import { cellKey } from "../line/line";
import { CODE_FONT } from "../tokens";
import {
  AppText,
  type EnvironmentProject,
  type EnvironmentThreadShell,
  PullRequestGlyph,
  pullRequestStatus,
  SymbolView,
  threadHasUnseenCompletion,
  type ThreadPrPresentation,
} from "../upstream/cells";
import {
  ENVIRONMENT_MACHINE_SYMBOLS,
  type EnvironmentMachineKind,
  ProjectFavicon,
} from "../upstream/home";
import { relativeTime } from "../upstream/needs";
import { sendCopy } from "./copies";
import { CellStates, HomeCellsHeld, HomeInFront, HomeStageContext, useMinute } from "./state";
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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Send a forming Cell's copy of Aski to this row when the row is handed another chat.
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

/** A card's marks: its machine and pull request in its bottom right, its project before its title. */
export interface CardMarks {
  readonly machine: EnvironmentMachineKind | null;
  readonly machineLabel: string | null;
  readonly pr: ThreadPrPresentation | null;
  readonly prLabel: string | null;
  readonly onOpenPullRequests: () => void;
  readonly project: EnvironmentProject | null;
}

/** Whether T3's list draws its shelves' headers: not on the home's tabs, which are the shelves. */
export function useShelfHeadersShown(): boolean {
  return use(HomeStageContext) === null;
}

/**
 * Whether a card says nothing at its top right: one on Awake, whose light says how its Cell is
 * and whose own time says since when (`AwakeRow`), so T3's "Working 5m" would say it twice.
 */
export function useSaysNothing(_status: string): boolean {
  return use(HomeStageContext) === "awake";
}

/** A card row's content with its Cell beside it, and its machine and pull request in its bottom right. */
export function CellBesideRow(props: {
  readonly thread: EnvironmentThreadShell;
  readonly marks: CardMarks;
  readonly children: ReactNode;
}) {
  const aski = useIsAskiChat(props.thread.id);
  const awake = use(HomeStageContext) === "awake";
  if (awake) return <AwakeRow thread={props.thread}>{props.children}</AwakeRow>;
  const { machine, pr } = props.marks;
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
        </View>
      </View>
    </View>
  );
}

/**
 * The card's padding, `pl-3 pr-4 py-3` (`upstream/substitutes/thread-list-v2-row-appearance.ts`),
 * less the 4 points an awake row takes back to stand as tall as Asleep's: its light fills the card.
 */
const AWAKE_FILL = { position: "absolute", top: -8, right: -16, bottom: -8, left: -12 } as const;
/** The Cell's middle from the card's left edge. */
const AWAKE_ANCHOR = 12 + BOX.width;

/** An awake Cell's row: the Cell, its title in one line, how long it's been like this, its light. */
function AwakeRow(props: {
  readonly thread: EnvironmentThreadShell;
  readonly children: ReactNode;
}) {
  const { thread } = props;
  const key = cellKey(thread);
  const state = use(CellStates).get(key);
  const light = ROW_LIGHT[rowStateOf(state?.stage, threadHasUnseenCompletion(thread))];
  return (
    <View className="-my-1 min-h-[28px] flex-row items-center gap-2">
      <RowLight key={key} thread={thread} light={light} fill={AWAKE_FILL} anchorX={AWAKE_ANCHOR} />
      <Figure thread={thread} points={2} />
      <View className="min-w-0 flex-1">{props.children}</View>
      {state?.since ? <Since since={state.since} /> : null}
    </View>
  );
}

/** How long it's been like this: flying for, landed for, waiting for. */
function Since(props: { readonly since: string }) {
  const now = useMinute();
  return (
    <AppText
      className="text-sm tabular-nums text-foreground-muted"
      style={{ fontFamily: CODE_FONT }}
    >
      {relativeTime(props.since, Date.parse(now))}
    </AppText>
  );
}

const MARK = 12;
const MARK_GAP = 6;
/** A title's project mark: the size of the title's capitals and a little over, and the gap after it. */
const TITLE_MARK = 16;
const TITLE_MARK_GAP = 7;
/** An inline view sits on the text's baseline; this centres the mark on the capitals instead. */
const TITLE_MARK_DROP = 2.5;

/** A project's own icon. */
export function ProjectMark(props: {
  readonly project: EnvironmentProject;
  readonly size: number;
}) {
  const { project } = props;
  return (
    <ProjectFavicon
      environmentId={project.environmentId}
      faviconPath={project.faviconPath}
      projectIcon={project.projectIcon}
      projectTitle={project.title}
      workspaceRoot={project.workspaceRoot}
      size={props.size}
    />
  );
}

const TITLE_MARK_STYLE: ViewStyle = {
  width: TITLE_MARK + TITLE_MARK_GAP,
  height: TITLE_MARK,
  transform: [{ translateY: TITLE_MARK_DROP }],
};

/**
 * The project's mark as a title's first glyph, inside its text: it takes room on the first line
 * only, and a second line runs under it, so no column of its own costs every line.
 */
export function TitleMark(props: {
  readonly project: EnvironmentProject;
  readonly faint?: boolean;
}) {
  return (
    <View style={props.faint ? [TITLE_MARK_STYLE, { opacity: 0.4 }] : TITLE_MARK_STYLE}>
      <ProjectMark project={props.project} size={TITLE_MARK} />
    </View>
  );
}

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
  const widths = [marks.machine ? MARK : 0, marks.pr ? MARK : 0].filter((width) => width > 0);
  return widths.reduce((sum, width) => sum + width, 0) + MARK_GAP * Math.max(widths.length - 1, 0);
}

const NOTHING: ViewStyle = {};
const HIDDEN: ViewStyle = { display: "none" };

/**
 * How T3's card lays out beside a Cell, two lines at most: its project's mark leads the title
 * (`lead`), and the time keeps the width of the marks under it, so the title's second line never
 * runs beneath them. A failed chat's error takes the second line, and the title one. On Awake,
 * one line: the faint mark and the title, as Asleep's rows are.
 */
export function useCardLines(beside: boolean, error: boolean, marks: CardMarks) {
  const awake = use(HomeStageContext) === "awake";
  if (!beside) return { beside, titleLines: 2, trailing: NOTHING, meta: NOTHING, lead: null };
  if (awake) {
    const lead = marks.project ? <TitleMark project={marks.project} faint /> : null;
    // A failed Cell keeps its error under the title: the one thing a light can't say.
    const meta = error ? { paddingLeft: 0, paddingRight: 0 } : HIDDEN;
    return { beside, titleLines: 1, trailing: NOTHING, meta, lead };
  }
  const width = marksWidth(marks);
  return {
    beside,
    titleLines: error ? 1 : 2,
    trailing: { minWidth: width, justifyContent: "flex-end" } satisfies ViewStyle,
    // The project's mark is inside the title, so nothing stands in front of it to inset past.
    meta: error ? { paddingLeft: 0, paddingRight: width + MARK_GAP } : HIDDEN,
    lead: marks.project ? <TitleMark project={marks.project} /> : null,
  };
}

/** A slim row's Cell; none in the iPad's sidebar, whose rows stay T3's. */
export function SlimRowCell(props: {
  readonly thread: EnvironmentThreadShell;
  readonly sidebar: boolean;
}) {
  return props.sidebar ? null : <Figure thread={props.thread} points={2} />;
}

/** A slim row's project, leading its title, faint as the row is, as a card's leads its. */
export function SlimRowProject(props: {
  readonly project: EnvironmentProject | null;
  readonly sidebar: boolean;
}) {
  return props.project && !props.sidebar ? <TitleMark project={props.project} faint /> : null;
}

export { swipeEdgeOf, swipeHint } from "./swipes";
