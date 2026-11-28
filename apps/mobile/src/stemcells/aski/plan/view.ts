// What a plan's rows say (stemcells/tasks/aski-orchestrator.md, decisions 4 and 12), read from
// its tray: a Cell's model line, which field Aski was unsure of, its first message with the
// risky phrases marked, and the plan's headline. Plain data, drawn by `PlanRows.tsx`.

import {
  messageOf,
  type ModelEntry,
  type StartAct,
  type Why,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import type { CellSeen } from "../../../../../../stemcells/orchestrator/rows.ts";
import {
  beforeOf,
  canStart,
  counts,
  held,
  type Tray,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import { DEFAULT_MODEL, headline, OWN_WORKTREE } from "../../../../../../stemcells/words/plans.ts";
import { conciseModelName } from "../../../../../../stemcells/models/names.ts";

export {
  HOLD_MS,
  PLAN_STATUS_WORDS as STATUS_WORDS,
  whyLines,
} from "../../../../../../stemcells/words/plans.ts";

export const PLAN_GONE = "This plan is no longer here.";
export const PLAN_UNREACHABLE = "The plan can’t be read from here.";
export const NEW_PROJECT_NAME = "Name the new project";
export const CLOSE_PLAN = "Close the plan";
export const HIDE_MESSAGE = "Hide the message";
export const SHOW_MESSAGE = "Show the message";

/**
 * The model and effort a Cell starts on: "Fable 5.1 · high", or the default, dim. `apart` adds
 * that it gets a worktree of its own, for a row that isn't a Cell yet.
 */
export function modelLine(
  act: Pick<StartAct, "model" | "selection" | "effort">,
  models: ReadonlyArray<ModelEntry>,
  apart = false,
): { readonly text: string; readonly dim: boolean } {
  const where = apart ? ` · ${OWN_WORKTREE}` : "";
  if (act.selection !== undefined) {
    const { instanceId, model, options } = act.selection;
    const entry = models.find((one) => one.instanceId === instanceId && one.id === model);
    const level = options?.find((one) => one.id === entry?.effortOption)?.value;
    const name = entry?.name ?? conciseModelName(model);
    return {
      text: `${typeof level === "string" ? `${name} · ${level}` : name}${where}`,
      dim: false,
    };
  }
  if (act.model !== null) {
    const level = act.model.effort?.level;
    return {
      text: `${level === undefined ? act.model.name : `${act.model.name} · ${level}`}${where}`,
      dim: false,
    };
  }
  return {
    text: `${act.effort === null ? DEFAULT_MODEL : `${DEFAULT_MODEL} · ${act.effort}`}${where}`,
    dim: true,
  };
}

/**
 * Whether a Cell that hasn't started gets a worktree of its own: the person's word, else its
 * project's default (`byDefault`). One that comes after a Cell of its own project works where
 * that one did.
 */
export function getsWorktree(tray: Tray, act: StartAct, byDefault: boolean): boolean {
  if (!(act.apart ?? byDefault)) return false;
  const key = (place: StartAct["place"]) => place?.projectId ?? place?.id ?? place?.name;
  return !beforeOf(tray, act).some(
    (one) => one.act.kind === "start" && key(one.act.place) === key(act.place),
  );
}

/** How each Cell stands, from its machine's needs list; nothing for a Cell not on it. */
export function seenIn(
  cells:
    | ReadonlyArray<{
        readonly threadId: string;
        readonly stage: CellSeen["stage"];
        readonly line: string | null;
        readonly landing?: { readonly verdict: string } | null;
      }>
    | undefined,
): (threadId: string) => CellSeen | null {
  return (threadId) => {
    const cell = cells?.find((one) => one.threadId === threadId);
    return cell === undefined
      ? null
      : { stage: cell.stage, line: cell.line, short: cell.landing?.verdict === "short" };
  };
}

const PLACE_WHYS: ReadonlyArray<Why> = [
  "place-open",
  "place-picked",
  "place-near",
  "place-apart",
  "new-project",
];

/** Which of a waiting Cell's fields Aski wasn't sure of. */
export function unsureOf(act: StartAct): { readonly place: boolean; readonly model: boolean } {
  return {
    place: act.place === null || act.why.some((why) => PLACE_WHYS.includes(why)),
    model: act.model?.how === "near",
  };
}

export interface MessageSpan {
  readonly text: string;
  readonly risky: boolean;
}

/** Every word of a Cell's first message, the risky phrases apart from the rest. */
export function messageSpans(act: Pick<StartAct, "words" | "note" | "risks">): MessageSpan[] {
  const whole = messageOf(act);
  const marks = act.risks
    .filter((mark) => mark.start < mark.end && mark.end <= act.words.length)
    .slice()
    .sort((a, b) => a.start - b.start);
  const spans: MessageSpan[] = [];
  let at = 0;
  for (const mark of marks) {
    // Marks that overlap read as one.
    const start = Math.max(mark.start, at);
    if (start >= mark.end) continue;
    if (start > at) spans.push({ text: whole.slice(at, start), risky: false });
    spans.push({ text: whole.slice(start, mark.end), risky: true });
    at = mark.end;
  }
  if (at < whole.length) spans.push({ text: whole.slice(at), risky: false });
  return spans;
}

/** A plan's headline and what its header offers. */
export function headOf(tray: Tray): {
  /** Null for a plan with no Cell: a deletion alone says what it is. */
  readonly line: string | null;
  /** Several Cells wait and can start: one tap starts them. */
  readonly startAll: boolean;
} {
  // A deletion waits on its own card: the headline counts Cells alone.
  const starts = tray.acts.filter((one) => one.act.kind === "start");
  const cells = starts.filter(
    (one) => one.status !== "dropped" && one.status !== "called-back",
  ).length;
  const { flying, waiting, queued } = counts(tray);
  const startable = starts.filter(
    (one) => one.act.kind === "start" && one.status === "waiting" && canStart(one.act),
  ).length;
  return {
    line: cells === 0 ? null : headline(cells, flying, waiting, false, queued),
    startAll: startable > 1 && !held(tray),
  };
}
