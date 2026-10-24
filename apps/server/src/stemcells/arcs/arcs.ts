/**
 * How the person's work with Cells goes, week by week, worked out from T3's
 * own records (`upstream/arcs.ts`), so it reaches back to the first run on
 * this server and keeps nothing of its own (stemcells/tasks/aski-forward.md, "Measured from
 * T3's own records"). The measures say what Cells give the person: longer
 * flights between their turns, fewer of their turns per Cell, asks they
 * answer in one move, answered sooner. Pure.
 */
import * as DateTime from "effect/DateTime";

import { stopOf } from "../needs/closeOut.ts";
import type { ArcRecords, ArcRun } from "../upstream/arcs.ts";

/** How a Cell's turn ended, by its close-out and then its words. */
export type StopKind = "done" | "yourStep" | "asked" | "stoppedShort" | "waiting" | "report";

export interface WeekArcs {
  /** The week's Monday, UTC. */
  readonly week: string;
  /** Cells that ran. */
  readonly cells: number;
  /** The person's own messages to Cells. */
  readonly yourTurns: number;
  /** Median, over the Cells the person wrote to. */
  readonly turnsPerCell: number | null;
  /** Median minutes a Cell worked between one of the person's turns and the next. */
  readonly flightMinutes: number | null;
  readonly stops: Readonly<Record<StopKind, number>>;
  /** Asks through the question tool: answered on their card in one move. */
  readonly asksThroughTool: number;
  readonly permissions: number;
  /** Median minutes from an ask to the person's answer. */
  readonly answerMinutes: number | null;
}

const DAY = 24 * 60 * 60 * 1000;
const PERMISSIONS = new Set(["command", "file-read", "file-change", "permission"]);

const at = (iso: string) => Date.parse(iso);
const minutes = (from: number, to: number) => Math.round((to - from) / 6_000) / 10;

/** The Monday, UTC, of the week a moment falls in. */
export function weekOf(moment: number): string {
  return DateTime.formatIsoDate(
    DateTime.startOf(DateTime.makeUnsafe(moment), "week", { weekStartsOn: 1 }),
  );
}

function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  return Math.round(value * 10) / 10;
}

export function stopKindOf(reply: string): StopKind {
  const stop = stopOf(reply);
  switch (stop.ask?.cue) {
    case "left":
      return "yourStep";
    case "question":
    case "offer":
      return "asked";
    case "stopped":
      return "stoppedShort";
  }
  if (stop.waits) return "waiting";
  return stop.line === null ? "report" : "done";
}

const NEEDS_ANSWER = new Set<StopKind>(["yourStep", "asked", "stoppedShort"]);

interface Week {
  cells: Set<string>;
  turns: Map<string, number>;
  flights: number[];
  stops: Record<StopKind, number>;
  asksThroughTool: number;
  permissions: number;
  answers: number[];
}

const emptyWeek = (): Week => ({
  cells: new Set(),
  turns: new Map(),
  flights: [],
  stops: { done: 0, yourStep: 0, asked: 0, stoppedShort: 0, waiting: 0, report: 0 },
  asksThroughTool: 0,
  permissions: 0,
  answers: [],
});

function byThread<T extends { readonly threadId: string }>(items: ReadonlyArray<T>) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.threadId, [...(groups.get(item.threadId) ?? []), item]);
  return groups;
}

/** Every week from `from` to `now`, the empty ones too. */
export function weeksOf(records: ArcRecords, from: number, now: number): ReadonlyArray<WeekArcs> {
  const weeks = new Map<string, Week>();
  for (let moment = at(weekOf(from)); moment <= now; moment += 7 * DAY) {
    weeks.set(weekOf(moment), emptyWeek());
  }
  const weekAt = (moment: number) => weeks.get(weekOf(moment));

  // A chat imported from before T3's V2 keeps its messages but not its runs:
  // only Cells that ran here count, so a week reads one way through.
  const ran = new Set(records.runs.map((run) => run.threadId));
  const turnsHere = records.turns.filter((turn) => ran.has(turn.threadId));
  const turnsOf = byThread(turnsHere);
  for (const turn of turnsHere) {
    const week = weekAt(at(turn.at));
    week?.turns.set(turn.threadId, (week.turns.get(turn.threadId) ?? 0) + 1);
  }

  for (const [threadId, runs] of byThread(records.runs)) {
    const turns = (turnsOf.get(threadId) ?? [])
      .map((turn) => at(turn.at))
      .toSorted((a, b) => a - b);
    for (const run of runs) weekAt(at(run.requestedAt))?.cells.add(threadId);
    // A flight: what the Cell ran from one of the person's turns until their next.
    turns.forEach((start, index) => {
      const end = turns[index + 1] ?? Number.POSITIVE_INFINITY;
      const flown = runs.filter((run) => {
        const requested = at(run.requestedAt);
        return requested >= start && requested < end && run.completedAt !== null;
      });
      if (flown.length === 0) return;
      const total = flown.reduce(
        (sum, run: ArcRun) => sum + at(run.completedAt!) - at(run.requestedAt),
        0,
      );
      weekAt(start)?.flights.push(minutes(0, total));
    });
    for (const run of runs) {
      if (run.status !== "completed" || run.reply === null || run.completedAt === null) continue;
      const ended = at(run.completedAt);
      const kind = stopKindOf(run.reply);
      const week = weekAt(ended);
      if (week === undefined) continue;
      week.stops[kind] += 1;
      if (!NEEDS_ANSWER.has(kind)) continue;
      const answer = turns.find((turn) => turn > ended);
      if (answer !== undefined) week.answers.push(minutes(ended, answer));
    }
  }

  for (const request of records.requests) {
    const week = weekAt(at(request.createdAt));
    if (week === undefined) continue;
    const asked = request.kind === "user_input";
    if (asked) week.asksThroughTool += 1;
    if (PERMISSIONS.has(request.kind)) week.permissions += 1;
    if ((asked || PERMISSIONS.has(request.kind)) && request.resolvedAt !== null) {
      if (request.status === "resolved") {
        week.answers.push(minutes(at(request.createdAt), at(request.resolvedAt)));
      }
    }
  }

  return [...weeks].map(([week, w]) => ({
    week,
    cells: w.cells.size,
    yourTurns: [...w.turns.values()].reduce((sum, count) => sum + count, 0),
    turnsPerCell: median([...w.turns.values()]),
    flightMinutes: median(w.flights),
    stops: w.stops,
    asksThroughTool: w.asksThroughTool,
    permissions: w.permissions,
    answerMinutes: median(w.answers),
  }));
}
