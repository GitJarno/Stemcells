// What a plan's row says of its Cell once the plan stands under its message
// (stemcells/tasks/aski-orchestrator.md, decisions 15 and 16): the Cell's own standing for one
// that started, and whom a queued one waits for. The same words on the Mac and the phone.

import { cellNameOf } from "../words/cellNames.ts";
import { afterLine, PLAN_STATUS_WORDS } from "../words/plans.ts";
import type { StartAct } from "./plan.ts";
import { beforeOf, type Tray, type TrayAct } from "./tray.ts";

/** A Cell as its client sees it in the needs list; null for one with no standing there. */
export interface CellSeen {
  readonly stage: "working" | "needs-you" | "done";
  /** Its own word: what it delivered, or what is left. */
  readonly line: string | null;
  /** It landed short of done: stopped, failed, rolled back or left waiting. */
  readonly short: boolean;
}

export interface RowSays {
  /** The row's standing, in a word or three; empty when there is nothing to say. */
  readonly word: string;
  /** The Cell's own line, under a Cell that landed or asks. */
  readonly line: string | null;
  /** Why a queued Cell won't start by itself; null while it simply waits its turn. */
  readonly stuck: string | null;
}

const NOTHING: RowSays = { word: "", line: null, stuck: null };

/** What the row of `one` says, with each Cell as `seenOf` sees it. */
export function rowSays(
  tray: Tray,
  one: TrayAct,
  seenOf: (threadId: string) => CellSeen | null,
): RowSays {
  if (one.act.kind !== "start" || one.status === "waiting") return NOTHING;
  if (one.status === "started") {
    const seen = seenOf(one.act.threadId);
    // Asleep, archived or not yet running: the row says no more than that it started.
    if (seen === null) return NOTHING;
    if (seen.stage === "working") return { ...NOTHING, word: PLAN_STATUS_WORDS.started };
    return {
      word: seen.stage === "needs-you" ? "Input" : seen.short ? "Stopped short" : "Landed",
      line: seen.line,
      stuck: null,
    };
  }
  if (one.status !== "queued") return { ...NOTHING, word: PLAN_STATUS_WORDS[one.status] };
  const before = beforeOf(tray, one.act);
  const names = before.map((each) => cellNameOf((each.act as StartAct).threadId));
  const stuck = before.flatMap((each, at) => {
    if (each.status === "dropped" || each.status === "failed" || each.status === "called-back")
      return [`${names[at]} never started`];
    const seen = each.act.kind === "start" ? seenOf(each.act.threadId) : null;
    return seen !== null && seen.stage === "done" && seen.short
      ? [`${names[at]} stopped short`]
      : [];
  });
  return { word: afterLine(names), line: null, stuck: stuck[0] ?? null };
}

/** Whether a plan has anything to show under its message: a Cell that wasn't dropped or called back. */
export const showsUnder = (tray: Tray): boolean =>
  tray.acts.some(
    (one) => one.act.kind === "start" && one.status !== "dropped" && one.status !== "called-back",
  );

/** How many of a plan's Cells fly now: on their way, or started and neither landed nor asking. */
export const flyingOf = (tray: Tray, seenOf: (threadId: string) => CellSeen | null): number =>
  tray.acts.filter((one) => {
    if (one.act.kind !== "start") return false;
    if (one.status === "starting") return true;
    const stage = one.status === "started" ? seenOf(one.act.threadId)?.stage : "done";
    return stage === undefined || stage === "working";
  }).length;
