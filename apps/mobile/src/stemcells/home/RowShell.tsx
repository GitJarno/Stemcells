// What a Cell's row is built from, wherever one stands: Awake's own (`RowCell.tsx`), a planned
// row forming at its top (`PlannedRows.tsx`), and a plan's row in Aski's chat
// (`aski/plan/PlanRow.tsx`). The Cell at the row's start, the project's mark, the title's type
// and what trails the line, so a change to one row carries to the others.

import type { ReactNode } from "react";
import { type StyleProp, useWindowDimensions, View, type ViewStyle } from "react-native";
import { useResolveClassNames } from "uniwind";

import { CellFigure } from "../cell/CellFigure";
import { type Face, faceOf } from "../cell/mood";
import { useCellLook } from "../cell/roster";
import { instanceOf } from "../cell/ThreadCell";
import { ProjectMark } from "../project/ProjectMark";
import { titleMarkLayout } from "../project/titleMark";
import {
  type EnvironmentProject,
  type EnvironmentThreadShell,
  resolveThreadListV2Status,
  useEnvironmentProviders,
  useThemeAppearance,
} from "../upstream/cells";
import { useMinute } from "./state";

/** A Cell's box at two points a cell (`cell/look.ts`, `BOX`). */
export const CELL = { width: 26, height: 28 };

/** A row's title, in the type T3's card sets it in; its ink is the row's own. */
export const ROW_TITLE = "text-base font-t3-medium";

/** The project's mark against a row's title, at the app's text size and the system's. */
export function useTitleMarkLayout() {
  const { fontScale } = useWindowDimensions();
  const base = useResolveClassNames("text-base").fontSize;
  const family = useResolveClassNames("font-sans").fontFamily;
  return titleMarkLayout((typeof base === "number" ? base : 16) * fontScale, family);
}

/**
 * A row's one line: what lies behind it, its Cell, its line, what trails it, and what lies over
 * it. A row that isn't a Cell yet has no Cell at its start.
 */
export function RowShell(props: {
  readonly className?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly under?: ReactNode;
  readonly creature?: ReactNode;
  /** The line's parts stand side by side, where the row lays them out itself. */
  readonly lined?: boolean;
  readonly children: ReactNode;
  readonly trailing?: ReactNode;
  readonly over?: ReactNode;
}) {
  return (
    <View className={props.className ?? "flex-row items-center"} style={props.style}>
      {props.under}
      {props.creature}
      <View className={props.lined ? "min-w-0 flex-1 flex-row items-center" : "min-w-0 flex-1"}>
        {props.children}
      </View>
      {props.trailing}
      {props.over}
    </View>
  );
}

/** The project's mark in its room before a title, a view of its own beside the title's text. */
export function RowMark(props: {
  readonly project: EnvironmentProject;
  /** Faint beside a Cell's title; whole where the mark is what the row asks about. */
  readonly opacity?: number;
}) {
  const mark = useTitleMarkLayout();
  return (
    <View style={{ width: mark.width, opacity: props.opacity ?? 0.4 }}>
      <ProjectMark project={props.project} size={mark.size} />
    </View>
  );
}

/**
 * A row's Cell from its forming to its first work, before and after its machine lists its chat:
 * awake until then, then as its chat stands.
 */
export function RowCreature(props: {
  readonly threadId: string;
  readonly thread: EnvironmentThreadShell | null;
  /** Its provider's driver, where the plan knows it before the machine lists the chat. */
  readonly driver?: string | undefined;
  /** When its glyphs start, on the Cells' clock; it just stands without. */
  readonly formingFrom?: number | undefined;
  readonly held?: boolean;
}) {
  const { thread } = props;
  const look = useCellLook(props.threadId);
  const ground = useThemeAppearance() === "light" ? "light" : "black";
  const providers = useEnvironmentProviders();
  const driver =
    (thread === null
      ? undefined
      : providers
          .get(thread.environmentId)
          ?.find((provider) => provider.instanceId === instanceOf(thread))?.driver) ??
    props.driver ??
    null;
  const minute = useMinute();
  const face: Face =
    thread === null
      ? { mood: "awake" }
      : faceOf(thread, resolveThreadListV2Status(thread), { now: Date.parse(minute), driver });
  return (
    <CellFigure
      name={props.threadId}
      mood={face.mood}
      activity={face.activity}
      provider={driver}
      look={look}
      points={2}
      plays={face.activity !== undefined || face.mood === "pleased"}
      ground={ground}
      formingFrom={props.formingFrom}
      held={props.held}
    />
  );
}
