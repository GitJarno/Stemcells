// What a plan's rows say (stemcells/tasks/aski-orchestrator.md, decisions 4 and 12), read from
// its tray: a Cell's model line, which field Aski was unsure of, its first message with the
// risky phrases marked, and the plan's headline. Plain data, drawn by `PlanRows.tsx`.

import {
  messageOf,
  type ModelEntry,
  type StartAct,
  type Why,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import {
  canStart,
  counts,
  held,
  type Status,
  type Tray,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import { DEFAULT_MODEL, headline, whyLine } from "../../../../../../stemcells/words/plans.ts";
import { conciseModelName } from "../../../../../../stemcells/models/names.ts";

/** How long a hand stays on a deletion before it runs. */
export const HOLD_MS = 1_200;

/** A Cell's standing once it no longer waits, as its row says it. */
export const STATUS_WORDS: Readonly<Record<Exclude<Status, "waiting">, string>> = {
  starting: "Starting",
  started: "Flying",
  dropped: "Dropped",
  failed: "Didn’t start",
  "called-back": "Called back",
  done: "Done",
};

export const PLAN_GONE = "This plan is no longer here.";
export const PLAN_UNREACHABLE = "The plan can’t be read from here.";
export const NEW_PROJECT_NAME = "Name the new project";
export const CLOSE_PLAN = "Close the plan";
export const HIDE_MESSAGE = "Hide the message";
export const SHOW_MESSAGE = "Show the message";

/** The model and effort a Cell starts on: "Fable 5.1 · high", or the default, dim. */
export function modelLine(
  act: Pick<StartAct, "model" | "selection" | "effort">,
  models: ReadonlyArray<ModelEntry>,
): { readonly text: string; readonly dim: boolean } {
  if (act.selection !== undefined) {
    const { instanceId, model, options } = act.selection;
    const entry = models.find((one) => one.instanceId === instanceId && one.id === model);
    const level = options?.find((one) => one.id === entry?.effortOption)?.value;
    const name = entry?.name ?? conciseModelName(model);
    return { text: typeof level === "string" ? `${name} · ${level}` : name, dim: false };
  }
  if (act.model !== null) {
    const level = act.model.effort?.level;
    return {
      text: level === undefined ? act.model.name : `${act.model.name} · ${level}`,
      dim: false,
    };
  }
  return {
    text: act.effort === null ? DEFAULT_MODEL : `${DEFAULT_MODEL} · ${act.effort}`,
    dim: true,
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

/**
 * Why a Cell waits, a line each, in the plan's own words. `held` says a deletion still waits:
 * once it is done or dropped, nothing is "after" it.
 */
export function whyLines(act: StartAct, held: boolean): string[] {
  const lines = act.why.flatMap((why) => {
    const line = why === "after-hold" && !held ? null : whyLine(act, why);
    return line === null ? [] : [line];
  });
  if (act.model?.how === "near") lines.push(`Heard “${act.model.heard}”. ${act.model.name}?`);
  return [...new Set(lines)];
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
  const { flying, waiting } = counts({ ...tray, acts: starts });
  const startable = starts.filter(
    (one) => one.act.kind === "start" && one.status === "waiting" && canStart(one.act),
  ).length;
  return {
    line: cells === 0 ? null : headline(cells, flying, waiting, false),
    startAll: startable > 1 && !held(tray),
  };
}
