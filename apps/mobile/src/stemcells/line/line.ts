// The phone's home as the Cells' line (stemcells/tasks/awake-asleep.md): Input, Awake and Asleep,
// as the Mac's column stands each Cell, so the two never disagree. Each machine says how its own
// Cells are (`read.ts`); Asleep, settled Cells and snoozed ones until they wake, is T3's own, from
// the chats' shells. Input is a lens over Awake: a Cell that asks keeps its place there.

import { effectiveSnoozed, type EnvironmentThreadShell } from "../upstream/threads";
import {
  type CellStanding,
  type Elsewhere,
  type FilterProject,
  type LineStage,
  type Need,
  shows,
  STAGE_WORDS,
} from "./kit";
import type { Reading } from "./read";

export const SEGMENTS: ReadonlyArray<{ readonly id: LineStage; readonly label: string }> = (
  ["needs", "awake", "asleep"] as const
).map((id) => ({ id, label: STAGE_WORDS[id] }));

/** An ask, and the machine it came from: each machine numbers only its own. */
export interface Ask {
  /** The machine and the need's own key: unique across machines. */
  readonly key: string;
  readonly environmentId: string;
  readonly need: Need;
}

/** How an awake Cell is, and since when: its flight's start, its landing, its oldest ask. */
export interface CellState {
  readonly stage: CellStanding["stage"];
  readonly since: string | null;
}

type Shell = Parameters<typeof effectiveSnoozed>[0] & {
  readonly id: string;
  readonly environmentId: string;
  readonly projectId: string;
  readonly settledOverride: EnvironmentThreadShell["settledOverride"];
};

export interface Line<S extends Shell> {
  /** Every ask in reach, oldest first, but those the person just answered. */
  readonly asks: ReadonlyArray<Ask>;
  /** Cells that ask, by their own record, on a machine that hasn't said what they ask yet. */
  readonly unread: ReadonlyArray<S>;
  /** Every Cell not asleep, those that ask too. */
  readonly awake: ReadonlyArray<S>;
  /** Settled, and snoozed until they wake. */
  readonly asleep: ReadonlyArray<S>;
  /** Each awake Cell's state, by `environmentId:id`. */
  readonly states: ReadonlyMap<string, CellState>;
}

export const cellKey = (cell: { readonly environmentId: string; readonly id: string }) =>
  `${cell.environmentId}:${cell.id}`;

/**
 * The line at `now` (an ISO time), from the Cells the home lists and each machine's reading. A
 * machine that hasn't answered (asleep, connecting, still being read, or without the line) stands
 * its Cells where their own records do (`ownState`), so none drops off the line. Keep it the only
 * home: until they answer, every machine looks like one without the line.
 */
export function lineOf<S extends Shell>(
  cells: ReadonlyArray<S>,
  readings: ReadonlyMap<string, Reading>,
  now: string,
  answered: ReadonlySet<string>,
  ownState: (cell: S) => CellState,
): Line<S> {
  const staged = new Map<string, ReadonlyMap<string, CellStanding>>();
  const asks: Ask[] = [];
  const askedSince = new Map<string, string>();
  for (const [environmentId, reading] of readings) {
    const list = reading.state === "none" ? null : reading.list;
    if (list === null) continue;
    staged.set(environmentId, new Map((list.cells ?? []).map((cell) => [cell.threadId, cell])));
    for (const need of list.needs) {
      const key = `${environmentId}:${need.key}`;
      if (!answered.has(key)) asks.push({ key, environmentId, need });
      const cell = `${environmentId}:${need.parentThreadId ?? need.threadId}`;
      const before = askedSince.get(cell);
      if (before === undefined || need.since < before) askedSince.set(cell, need.since);
    }
  }
  asks.sort((a, b) => a.need.since.localeCompare(b.need.since) || a.need.number - b.need.number);
  const line = { asks, unread: [] as S[], awake: [] as S[], asleep: [] as S[] };
  const states = new Map<string, CellState>();
  for (const cell of cells) {
    if (cell.settledOverride === "settled" || effectiveSnoozed(cell, { now })) {
      line.asleep.push(cell);
      continue;
    }
    const stages = staged.get(cell.environmentId);
    const standing = stages?.get(cell.id);
    // A machine that answered without it: it never flew, or it woke since that reading.
    if (stages !== undefined && standing === undefined) continue;
    const { stage, since } =
      standing === undefined
        ? ownState(cell)
        : { stage: standing.stage, since: standing.since ?? null };
    const key = cellKey(cell);
    line.awake.push(cell);
    states.set(key, {
      stage,
      since: since ?? (stage === "needs-you" ? (askedSince.get(key) ?? null) : null),
    });
    if (stage === "needs-you" && stages === undefined) line.unread.push(cell);
  }
  return { ...line, states };
}

/** How many each segment holds in view: Input counts every ask, wherever it is, read or not. */
export function countsOf<S extends Shell>(
  line: Line<S>,
  inView: (cell: { readonly environmentId: string; readonly projectId: string }) => boolean,
): Readonly<Record<LineStage, number>> {
  return {
    needs: line.asks.length + line.unread.length,
    awake: line.awake.filter(inView).length,
    asleep: line.asleep.filter(inView).length,
  };
}

/** Where the asks the filter leaves out are: by project in the picker's order, then the rest. */
export function elsewhereOf(
  asks: ReadonlyArray<Ask>,
  inView: (ask: { readonly environmentId: string; readonly projectId: string }) => boolean,
  projects: ReadonlyArray<FilterProject>,
): ReadonlyArray<Elsewhere> {
  const left = asks.filter((ask) => !inView({ ...ask, projectId: ask.need.projectId }));
  const where = (ask: Ask) =>
    projects.findIndex((project) => shows(project, ask.environmentId, ask.need.projectId));
  const named = projects.flatMap((project, index) => {
    const count = left.filter((ask) => where(ask) === index).length;
    return count > 0 ? [{ name: project.name, count }] : [];
  });
  const unplaced = left.filter((ask) => where(ask) === -1).length;
  return unplaced > 0 ? [...named, { name: null, count: unplaced }] : named;
}

/** Where the home opens: on Input when anything waits, else on Awake. */
export function opensOn(counts: Readonly<Record<LineStage, number>>): LineStage {
  return counts.needs > 0 ? "needs" : "awake";
}

/**
 * Whether Asleep reads its next page as the person nears its end: only while Cells are left and
 * no page is on its way. A failed read waits for a tap, or each refusal would ask again.
 */
export function readsNextPage(shelf: {
  readonly hidden: number;
  readonly loading: boolean;
  readonly failed: boolean;
}): boolean {
  return shelf.hidden > 0 && !shelf.loading && !shelf.failed;
}
