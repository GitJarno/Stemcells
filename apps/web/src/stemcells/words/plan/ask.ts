import { CHIP } from "../docText";

/**
 * What Aski's planner is asked (stemcells/tasks/prompting.md, decision 11):
 * only what the words left open, for each numbered Cell. The facts are
 * final; the answer can't change a typed word, and code checks it
 * (`check.ts`).
 */

/** A Cell as the words set it: its model and effort as read back, and its place, or null when open. */
export interface AskCell {
  readonly model: string | null;
  readonly effort: string | null;
  readonly place: string | null;
}

export interface AskProject {
  readonly name: string;
  /** The first paragraph of its AGENTS.md, CLAUDE.md or README. */
  readonly line: string | null;
}

export interface PlanAsk {
  /** The message as the person wrote it, code and all; a chip is one `CHIP`. */
  readonly text: string;
  /** Each chip's words as upstream sends them, in the order they stand. */
  readonly chips?: readonly string[];
  /** The message without its setup words: the work. */
  readonly task: string;
  /** Its [bracketed] passages, word for word, by where they stand in `text`. */
  readonly verbatims: ReadonlyArray<{
    readonly start: number;
    readonly end: number;
    readonly text: string;
  }>;
  readonly cells: readonly AskCell[];
  /** The projects an open Cell may go to: the mentioned ones first, then the recent ones. */
  readonly projects: readonly AskProject[];
}

/** The most projects the planner reads (decision 11): every one more is time and a chance to collide. */
export const MOST_PROJECTS = 12;

/**
 * The instructions. They name no project: names come only in the list, and
 * an answer's project must be one of them (`check.ts`).
 */
export const INSTRUCTIONS = `You divide a message among Cells, coding agents that each start in one project. The person's words already set how many Cells start, on which model and with what effort. Answer only what they left open.

For each numbered Cell, answer once:
- cell: its number.
- title: a few words naming its part, at most six.
- prompt: its first message. Give each Cell its own share of the work, in the person's own words where you can, so that every part of the message goes to some Cell. Copy each passage marked ⟦P1⟧ … ⟦/P1⟧ word for word into exactly one prompt, without the marks.
- project: only when its place is open. Name one project from the list, the one whose description fits its share.

Add no step the person didn't ask for.`;

/**
 * The message with each [bracketed] passage marked ⟦Pn⟧ … ⟦/Pn⟧, in the
 * order they stand, and each chip in its words.
 */
export function markedText(ask: Pick<PlanAsk, "text" | "verbatims" | "chips">): string {
  let out = "";
  let at = 0;
  ask.verbatims
    .toSorted((a, b) => a.start - b.start)
    .forEach((verbatim, i) => {
      out += `${ask.text.slice(at, verbatim.start)}⟦P${i + 1}⟧${verbatim.text}⟦/P${i + 1}⟧`;
      at = verbatim.end;
    });
  out += ask.text.slice(at);
  let chip = 0;
  return out.replaceAll(CHIP, () => ask.chips?.[chip++] ?? "");
}

/** The whole prompt the planner gets; `failed` lists what its last answer got wrong, for the one retry. */
export function plannerPrompt(ask: PlanAsk, failed: readonly string[] = []): string {
  const cells = ask.cells.map(
    (cell, i) =>
      `${i + 1}. model ${cell.model ?? "default"}, effort ${cell.effort ?? "default"}, place ${cell.place ?? "open"}`,
  );
  const projects = ask.projects
    .slice(0, MOST_PROJECTS)
    .map((project) => `- ${project.name}${project.line ? `: ${project.line}` : ""}`);
  return [
    INSTRUCTIONS,
    "",
    "The message:",
    "<<<",
    markedText(ask),
    ">>>",
    "",
    `The Cells (${ask.cells.length}):`,
    ...cells,
    ...(projects.length > 0 ? ["", "Projects:", ...projects] : []),
    ...(failed.length > 0
      ? [
          "",
          "Your last answer failed these checks; answer again, fixing them:",
          ...failed.map((f) => `- ${f}`),
        ]
      : []),
  ].join("\n");
}
