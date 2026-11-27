// The words a plan shows the person (stemcells/tasks/aski-orchestrator.md, decisions 4, 7 and
// 12), the same on the Mac and the phone.

import type { Act, DestroyAct, StartAct, Why } from "../orchestrator/plan.ts";

/** How long a hand stays down on a deletion before it runs, in ms. */
export const HOLD_MS = 1200;

/** An act's standing once it no longer waits, as its row says it. */
export const PLAN_STATUS_WORDS = {
  starting: "Starting",
  started: "Flying",
  dropped: "Dropped",
  failed: "Didn’t start",
  "called-back": "Called back",
  done: "Done",
} as const;

/** Why a Cell waits, as its row says it; null when the reason needs no words. */
export function whyLine(act: StartAct, why: Why): string | null {
  const place = act.place;
  switch (why) {
    case "place-open":
      return "Which project?";
    case "place-picked":
      return place === null ? "Which project?" : `Aski picked ${place.name}`;
    case "place-near":
      return place === null || place.heard === null
        ? "Which project?"
        : `Heard “${place.heard}”. ${place.name}?`;
    case "place-apart":
      return place === null ? "Which project?" : `In ${place.name}?`;
    case "new-project":
      return "A new project";
    case "risky":
      return "Is this what you meant?";
    case "over-cap":
      return "More than you start at once";
    case "left-over":
      return "Some words went to no Cell";
    case "after-hold":
      return "After the deletion";
    case "proposed":
      return "Aski’s words";
    case "always":
      return null;
  }
}

/** What a deletion says it will do, naming the thing as the app writes it. */
export function holdLine(act: DestroyAct): string {
  if (act.target === "project")
    return act.place === null ? "Delete a project" : `Delete the project ${act.place.name}`;
  if (act.cells.length > 0)
    return `Archive ${act.cells.map((cell) => cell.name).join(", ")}`;
  return act.place === null ? "Archive Cells" : `Archive every Cell in ${act.place.name}`;
}

/** What stays, under a deletion: the person should know before their hand goes down. */
export const holdStays = (act: DestroyAct): string =>
  act.target === "project"
    ? "Its folder stays on disk. Its Cells leave the app."
    : "Archived Cells leave the lists. Their work stays.";

/** The person's own words for the deletion, without the stop they ended on. */
export const HOLD_HEARD = (heard: string): string =>
  `You said “${heard.trim().replace(/[.!?,;:]+$/u, "")}”.`;
export const HOLD_PRESS = "Press and hold to confirm";
export const HOLD_UNKNOWN = "Aski couldn’t tell which. Nothing is deleted.";

/** The plan's headline: "4 Cells · 3 flying · 1 waiting on you". */
export function headline(cells: number, flying: number, waiting: number, reading: boolean): string {
  if (reading) return "Aski is reading…";
  // A message that only deletes: its card says the rest.
  if (cells === 0) return "Deletion";
  const parts = [`${cells} ${cells === 1 ? "Cell" : "Cells"}`];
  if (flying > 0 && waiting > 0) parts.push(`${flying} flying`);
  if (waiting > 0) parts.push(`${waiting} waiting on you`);
  return parts.join(" · ");
}

export const FLOOR_LINE = "Aski couldn’t read that as Cells to start. It went to Aski’s chat.";
export const LEFT_OVER = (words: string): string => `Given to no Cell: “${words}”`;
export const START = "Start";
export const START_ALL = "Start all";
export const DROP = "Drop";
export const CALL_BACK = "Call back";
export const DEFAULT_MODEL = "Default model";
export const DICTATED = "Dictated";

/** A row's place, as it reads. */
export const placeLabel = (act: Act): string =>
  act.place === null ? "No project" : act.place.name;

/**
 * Why a Cell waits, a line each. `held` says a deletion still waits: once it is done or
 * dropped, nothing is "after" it.
 */
export function whyLines(act: StartAct, held: boolean): string[] {
  const lines = act.why.flatMap((why) => {
    const line = why === "after-hold" && !held ? null : whyLine(act, why);
    return line === null ? [] : [line];
  });
  if (act.model?.how === "near") lines.push(`Heard “${act.model.heard}”. ${act.model.name}?`);
  return [...new Set(lines)];
}
