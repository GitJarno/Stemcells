// The phone's home on the Cells' line (stemcells/tasks/awake-asleep.md), under Aski, narrowed by
// the header's picks. Input, Awake and Asleep hand T3's list their Cells, a list each, all mounted
// (`home/StagePages.tsx`). An ask is answered in its Cell's chat (`ChatAsk.tsx`), and Input's loop
// opens the next (`inbox/useInbox.ts`); the app icon counts every ask, whatever the picks show.

import { useEffect, useSyncExternalStore, useState, type ReactNode } from "react";
import { View } from "react-native";

import { takeAskedStage, useAskedStage } from "../aski/turn";
import { DiskFoot } from "../disk/DiskPlate";
import { useAppBadge } from "../push/badge";
import { EmptyTab } from "../home/EmptyTab";
import { StagePages, useStagePages } from "../home/StagePages";
import { CellStates, HomeTabsContext, tabChoice } from "../home/state";
import { type AllClear, useInbox } from "../inbox/useInbox";
import { inTab } from "../home/tabs";
import { useLineMotion } from "../home/useLineMotion";
import { type EnvironmentThreadShell, resolveThreadWorkingStartedAt } from "../upstream/cells";
import { answering } from "./answer";
import { clearedWords, EMPTY_WORDS, type LineStage, STEM_CELL_FACTS } from "./kit";
import { askCount, type CellState, cellKey, countsOf, lineOf, SEGMENTS } from "./line";
import type { Reading } from "./read";
import { UndoLine } from "./UndoLine";

const segments = tabChoice<LineStage>();
const STAGES = ["needs", "awake", "asleep"] as const satisfies ReadonlyArray<LineStage>;

type Place = { readonly environmentId: string; readonly projectId: string };

/** How a Cell's own record has it, as T3's tabs read it, while its machine hasn't said. */
const byRecord =
  (now: string) =>
  (cell: EnvironmentThreadShell): CellState =>
    inTab(cell, "input", now)
      ? { stage: "needs-you", since: cell.pendingUserInputAt ?? null }
      : inTab(cell, "working", now)
        ? { stage: "working", since: resolveThreadWorkingStartedAt(cell) }
        : { stage: "done", since: cell.latestRun?.completedAt ?? null };

/** The same states while no awake Cell's changed, so a list's rows draw again only for a change. */
function useSteadyStates(states: ReadonlyMap<string, CellState>) {
  const [kept, keep] = useState(states);
  const same =
    kept.size === states.size &&
    [...states].every(([key, state]) => {
      const before = kept.get(key);
      return before?.stage === state.stage && before.since === state.since;
    });
  if (!same) keep(states);
  return same ? kept : states;
}

/** Input after a clearing: what it did, the Cells awake now flying again, and its fact. */
function allClearOf(
  { cleared, fact }: AllClear,
  awake: ReadonlyArray<{ readonly environmentId: string; readonly id: string }>,
) {
  const flying = awake.filter((cell) => cleared.cells.has(cellKey(cell))).length;
  return { words: clearedWords(flying, cleared.ms), fact: STEM_CELL_FACTS[fact] };
}

export function LineHome(props: {
  /** The Cells the home lists: T3's chats but Aski's, archived ones and Subcells. */
  readonly cells: ReadonlyArray<EnvironmentThreadShell>;
  readonly readings: ReadonlyMap<string, Reading>;
  /** Every machine in view has answered once: the asks can be counted. */
  readonly known: boolean;
  readonly now: string;
  readonly inView: (place: Place) => boolean;
  /** What `inView` lets through, as a word that changes with it. */
  readonly picks: string;
  readonly environmentId: string | null;
  /** Its machines haven't sent their Cells yet. */
  readonly connecting: boolean;
  /** New chats on their way, which Awake lists first. */
  readonly pending: number;
  /** Asleep Cells in view that the servers keep back from the phone: settled ones. */
  readonly olderSettled: number;
  /** T3's list, handed these Cells, and the new chats on their way with `pending`. */
  readonly renderList: (
    cells: ReadonlyArray<EnvironmentThreadShell>,
    pending: boolean,
  ) => ReactNode;
}) {
  const { answered } = useSyncExternalStore(answering.subscribe, answering.read);
  const line = lineOf(props.cells, props.readings, props.now, answered, byRecord(props.now));
  const states = useSteadyStates(line.states);
  const onPhone = countsOf(line, props.inView);
  const counts = useLineMotion(
    line,
    props.cells,
    props.inView,
    { ...onPhone, asleep: onPhone.asleep + props.olderSettled },
    !props.connecting,
    props.picks,
  );
  const tab = segments.useTab("awake");
  const stages = useStagePages(STAGES, tab);
  const cleared = useInbox(line.needs.filter(props.inView), tab === "needs");
  // Only once every machine has answered: a cold start would clear the icon a closed app was given.
  useAppBadge(props.known ? askCount(line) : null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Forget answered asks the machines stopped asking, as each reading comes in.
  useEffect(() => {
    const asked = new Set<string>();
    for (const [environmentId, reading] of props.readings)
      if (reading.state !== "none")
        for (const need of reading.list?.needs ?? []) asked.add(`${environmentId}:${need.key}`);
    answering.keepOnly(asked, Date.now());
  }, [props.readings]);

  // T3's list narrows to the pickers too; handed only those, an empty segment says so in ours.
  const page = (stage: LineStage) => {
    if (props.connecting) return <EmptyTab words="Connecting…" />;
    const shown = line[stage].filter(props.inView);
    const listed =
      shown.length > 0 ||
      (stage === "awake" && props.pending > 0) ||
      (stage === "asleep" && props.olderSettled > 0);
    if (!listed)
      return stage === "needs" && cleared !== null ? (
        <EmptyTab {...allClearOf(cleared, line.awake)} />
      ) : (
        <EmptyTab words={EMPTY_WORDS[stage]} />
      );
    return stage !== "asleep" ? (
      <CellStates value={states}>{props.renderList(shown, stage === "awake")}</CellStates>
    ) : (
      props.renderList(shown, false)
    );
  };
  const home = {
    tab,
    options: SEGMENTS.map((segment) => ({ ...segment, count: counts[segment.id] })),
    night: tab === "asleep",
    choose: (id: string) => {
      stages.show(id as LineStage);
      segments.choose(id as LineStage);
    },
    environmentId: props.environmentId,
  };
  const asked = useAskedStage();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- turns to the stage Aski showed, which its button's store holds until a home takes it
  useEffect(() => {
    if (asked === null) return;
    const stage = takeAskedStage();
    if (stage !== null) home.choose(stage);
  }, [asked, home]);
  return (
    <HomeTabsContext value={home}>
      <View style={{ flex: 1 }}>
        <StagePages home={stages} tab={tab} night={home.night} render={page} />
        <DiskFoot />
        <UndoLine />
      </View>
    </HomeTabsContext>
  );
}
