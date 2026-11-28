// What Aski's chat is told about a plan (stemcells/tasks/aski-orchestrator.md, decision 1). The
// person's message reaches Aski's chat as they wrote it; beside it stands one line saying a plan
// is already being carried out, so Aski starts nothing and reads what came of it. Model-facing
// text: `evals/README.md` applies.

import { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
import type { Act, Plan } from "../../../../../stemcells/orchestrator/plan.ts";
import type { ActOutcome, Standing } from "./book.ts";

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

/** The longest a Cell's own word is passed on. */
const LINE_MOST = 240;

/** How a Cell stands, in a few words. Its own word is quoted: it is the Cell's claim, not a fact. */
function standingWords(standing: Standing): string {
  const line = standing.line?.replace(/\s+/gu, " ").trim() ?? "";
  const said =
    line.length === 0
      ? ""
      : `. It says: “${line.length > LINE_MOST ? `${line.slice(0, LINE_MOST - 1)}…` : line}”`;
  if (standing.stage === "working") return "flying";
  if (standing.stage === "needs-you") return `asks for the person${said}`;
  const how =
    standing.landing?.verdict === "shown"
      ? "landed, and a check or its pull request shows it"
      : standing.landing?.verdict === "short"
        ? "stopped short of done"
        : "landed, on its own word";
  return `${how}${said}`;
}

/** The note beside a message to Aski's chat when Cells it started landed or asked since. */
export const newsNote = (
  news: ReadonlyArray<{
    readonly act: Act & { readonly kind: "start" };
    readonly standing: Standing;
  }>,
): string =>
  [
    "Stemcells, telling you, not the person: since you last heard, of the Cells this chat started:",
    ...news.map(
      ({ act, standing }) =>
        `- ${link(`${cellNameOf(act.threadId)}: ${act.title}`, act.threadId)}: ${standingWords(standing)}.`,
    ),
    "Say so only where it bears on what the person asks now.",
  ].join("\n");

function lineOf(act: Act, outcome: ActOutcome | undefined, standing: Standing | null): string {
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
      return `- Started: ${cell}.${standing === null ? "" : ` Now: ${standingWords(standing)}.`}`;
    case "queued":
      return `- Queued: ${name}, "${act.title}" in ${where}${on}. Stemcells starts it itself once the Cells it comes after have landed; the person can start or drop it on the plan's card.`;
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

/**
 * A plan and what came of it, for Aski's chat. `outcome` is null while the client hasn't said;
 * `standingOf` says how a Cell that started stands now, when the needs list has it.
 */
export function planReport(
  plan: Plan,
  outcome: ReadonlyArray<ActOutcome> | null,
  standingOf: (threadId: string) => Standing | null = () => null,
): string {
  if (plan.acts.length === 0)
    return "Nothing in the message started, created or deleted anything. It is yours to answer.";
  const byAct = new Map((outcome ?? []).map((one) => [one.i, one]));
  const talk = plan.talk
    .map((n) => plan.pieces.find((piece) => piece.n === n)?.text)
    .filter((text) => text !== undefined);
  return [
    ...plan.acts.map((act) =>
      lineOf(act, byAct.get(act.i), act.kind === "start" ? standingOf(act.threadId) : null),
    ),
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

/**
 * The line a Cell that came after others is told, after its own words: whom it came after. It
 * is handed nothing they wrote (decision 16).
 */
export function afterNote(
  before: ReadonlyArray<{ readonly threadId: string; readonly title: string }>,
  sameFolder: boolean,
): string {
  const whom = before
    .map((one) => `${cellNameOf(one.threadId)} (“${one.title}”, thread ${one.threadId})`)
    .join(" and ");
  return `Stemcells, telling you, not the person: you were asked to start once ${whom} had landed, and ${before.length === 1 ? "it has" : "they have"}.${sameFolder ? " You work in the folder it worked in: its changes are here." : ""}`;
}
