// The phone's home as the Cells' line (stemcells/tasks/phone-line.md): Needs you, Working,
// Landed and Settled, where the column stands each Cell, so the Mac and the phone never
// disagree. Each machine says where its own Cells stand (`read.ts`); Settled, and the snoozed
// Cells that are off the line until they wake, are T3's own, from the chats' shells.

import { effectiveSnoozed, type EnvironmentThreadShell } from "../upstream/threads";
import {
  type Elsewhere,
  type FilterProject,
  type LineStage,
  type Need,
  shows,
  standingsOf,
  type Standings,
} from "./kit";
import type { Reading } from "./read";

export const SEGMENTS: ReadonlyArray<{ readonly id: LineStage; readonly label: string }> = [
  { id: "needs", label: "Needs you" },
  { id: "working", label: "Flying" },
  { id: "landed", label: "Landed" },
  { id: "settled", label: "Settled" },
];

/** An ask, and the machine it came from: each machine numbers only its own. */
export interface Ask {
  /** The machine and the need's own key: unique across machines. */
  readonly key: string;
  readonly environmentId: string;
  readonly need: Need;
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
  readonly working: ReadonlyArray<S>;
  readonly landed: ReadonlyArray<S>;
  readonly settled: ReadonlyArray<S>;
  /** Off the line until they wake; Settled holds T3's shelf of them. */
  readonly snoozed: ReadonlyArray<S>;
}

/**
 * The line at `now` (an ISO time), from the Cells the home lists and each machine's reading. A
 * machine that hasn't answered (asleep, connecting, still being read, or without the line) stands
 * its Cells where their own records do (`ownStage`), so none drops off the line. Keep it the only
 * home: until they answer, every machine looks like one without the line.
 */
export function lineOf<S extends Shell>(
  cells: ReadonlyArray<S>,
  readings: ReadonlyMap<string, Reading>,
  now: string,
  answered: ReadonlySet<string>,
  ownStage: (cell: S) => "needs" | "working" | "landed",
): Line<S> {
  const staged = new Map<string, Standings>();
  const asks: Ask[] = [];
  for (const [environmentId, reading] of readings) {
    const list = reading.state === "none" ? null : reading.list;
    if (list === null) continue;
    staged.set(environmentId, standingsOf(list.cells ?? [], []));
    for (const need of list.needs) {
      const key = `${environmentId}:${need.key}`;
      if (!answered.has(key)) asks.push({ key, environmentId, need });
    }
  }
  asks.sort((a, b) => a.need.since.localeCompare(b.need.since) || a.need.number - b.need.number);
  const line = {
    asks,
    unread: [] as S[],
    working: [] as S[],
    landed: [] as S[],
    settled: [] as S[],
    snoozed: [] as S[],
  };
  for (const cell of cells) {
    // T3's own order: a snoozed Cell is on its shelf even once settled.
    if (effectiveSnoozed(cell, { now })) {
      line.snoozed.push(cell);
      continue;
    }
    const stages = staged.get(cell.environmentId);
    const stage =
      cell.settledOverride === "settled"
        ? "settled"
        : stages === undefined
          ? ownStage(cell)
          : stages.get(cell.id);
    if (stage === undefined) continue;
    if (stage !== "needs") line[stage].push(cell);
    else if (stages === undefined) line.unread.push(cell);
  }
  return line;
}

/** How many each segment holds in view: Needs you counts every ask, wherever it is, read or not. */
export function countsOf<S extends Shell>(
  line: Line<S>,
  inView: (cell: { readonly environmentId: string; readonly projectId: string }) => boolean,
): Readonly<Record<LineStage, number>> {
  return {
    needs: line.asks.length + line.unread.length,
    working: line.working.filter(inView).length,
    landed: line.landed.filter(inView).length,
    settled: line.settled.filter(inView).length,
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

/** Where the home opens: on Needs you when anything waits, else where Cells are. */
export function opensOn(counts: Readonly<Record<LineStage, number>>): LineStage {
  return counts.needs > 0
    ? "needs"
    : counts.working > 0 || counts.landed === 0
      ? "working"
      : "landed";
}
