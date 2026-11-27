// What Aski's chat is told about a plan (stemcells/tasks/aski-orchestrator.md, decision 1). The
// person's message reaches Aski's chat as they wrote it; beside it stands one line saying a plan
// is already being carried out, so Aski starts nothing and reads what came of it. Model-facing
// text: `evals/README.md` applies.

import { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
import type { Act, Plan } from "../../../../../stemcells/orchestrator/plan.ts";
import type { ActOutcome } from "./book.ts";

/** The note beside a message that a plan was made from. */
export const planNote = (plan: Plan): string =>
  `Stemcells, telling you, not the person: Stemcells is already carrying out what this message starts, creates or deletes (plan ${plan.id}). Start, create and delete nothing yourself. Call stemcells_plan with that id, then reply in one line that names each Cell it started as its link and says what waits for the person. Answer anything else in the message as you would.`;

const link = (title: string, threadId: string) =>
  `[${title.replace(/[[\]]/g, "")}](t3-thread://v1/${threadId})`;

const WHY: Readonly<Record<string, string>> = {
  "place-open": "no project was named",
  "place-picked": "the project was chosen for them",
  "place-near": "the project's name was misheard",
  "place-apart": "the project may be meant for another Cell",
  "new-project": "it makes a new project",
  risky: "its words ask for something that can't be taken back",
  "over-cap": "it is more Cells than they start at once",
  "left-over": "some of the message was given to no Cell",
  "after-hold": "the message also deletes something",
  always: "they check every plan",
  proposed: "the words are yours",
};

function lineOf(act: Act, outcome: ActOutcome | undefined): string {
  const status = outcome?.status ?? (act.tier === "start" ? "starting" : "waiting");
  if (act.kind === "destroy") {
    const what =
      act.target === "project"
        ? `delete the project ${act.place?.name ?? "(not found)"}`
        : `archive ${act.cells.length > 0 ? act.cells.map((cell) => cell.name).join(", ") : `the Cells of ${act.place?.name ?? "(not found)"}`}`;
    return status === "done"
      ? `- Done, by the person's own hand: ${what}.`
      : status === "dropped"
        ? `- Dropped by the person: ${what}.`
        : `- Held for the person's own hand, in the app: ${what}. You can't confirm it for them.`;
  }
  const name = cellNameOf(act.threadId);
  const where = act.place === null ? "no project yet" : act.place.name;
  const on = act.model === null ? "" : ` on ${act.model.name}`;
  const cell = `${link(`${name}: ${act.title}`, act.threadId)} in ${where}${on}`;
  switch (status) {
    case "started":
    case "starting":
      return `- Started: ${cell}.`;
    case "failed":
      return `- Didn't start: ${name}, "${act.title}" in ${where}${outcome?.reason ? ` (${outcome.reason})` : ""}.`;
    case "dropped":
      return `- Dropped by the person: "${act.title}" in ${where}.`;
    case "called-back":
      return `- Called back by the person: "${act.title}" in ${where}.`;
    default:
      return `- Waiting for the person's tap: "${act.title}" in ${where}${on}, because ${act.why.map((why) => WHY[why] ?? why).join(" and ")}.`;
  }
}

/** A plan and what came of it, for Aski's chat. `outcome` is null while the client hasn't said. */
export function planReport(plan: Plan, outcome: ReadonlyArray<ActOutcome> | null): string {
  if (plan.acts.length === 0)
    return "Nothing in the message started, created or deleted anything. It is yours to answer.";
  const byAct = new Map((outcome ?? []).map((one) => [one.i, one]));
  const talk = plan.talk
    .map((n) => plan.pieces.find((piece) => piece.n === n)?.text)
    .filter((text) => text !== undefined);
  return [
    ...plan.acts.map((act) => lineOf(act, byAct.get(act.i))),
    ...(plan.leftOver.length > 0
      ? [
          `- Given to no Cell: "${plan.leftOver
            .map((n) => plan.pieces.find((piece) => piece.n === n)?.text ?? "")
            .join(" … ")}". Ask the person what they meant by it.`,
        ]
      : []),
    ...(talk.length > 0 ? [`- Yours to answer: "${talk.join(" … ")}".`] : []),
  ].join("\n");
}
