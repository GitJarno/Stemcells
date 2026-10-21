/**
 * Code checks the planner's answer (stemcells/tasks/prompting.md, decision
 * 11); nothing else reviews it. A failed check names what to fix, for the
 * one retry.
 */
import type { WordsPlace } from "../places";
import type { PlanAsk } from "./ask";

/** A Cell as the planner answered it, checked. */
export interface AnsweredCell {
  readonly title: string;
  readonly prompt: string;
  /** The project Aski picked, on an open Cell; null on a set one. */
  readonly project: WordsPlace | null;
}

export type Checked =
  | { readonly ok: true; readonly cells: readonly AnsweredCell[] }
  | { readonly ok: false; readonly failed: readonly string[] };

/** The longest title a Cell takes. */
export const TITLE_MOST = 60;

/** Words too common to tell whether a part of the message reached a prompt. */
const COMMON = new Set(
  "that this with from they them then than have into only just also what when where which your their there make sure each some more does like".split(
    " ",
  ),
);

interface RawCell {
  readonly cell: number;
  readonly title: string;
  readonly prompt: string;
  readonly project?: string;
}

function rawCells(answer: unknown): RawCell[] | null {
  if (typeof answer !== "object" || answer === null) return null;
  const cells = (answer as { cells?: unknown }).cells;
  if (!Array.isArray(cells)) return null;
  const out: RawCell[] = [];
  for (const cell of cells) {
    if (typeof cell !== "object" || cell === null) return null;
    const { cell: n, title, prompt, project } = cell as Record<string, unknown>;
    if (typeof n !== "number" || typeof title !== "string" || typeof prompt !== "string")
      return null;
    if (project !== undefined && typeof project !== "string") return null;
    out.push({ cell: n, title, prompt, ...(project === undefined ? {} : { project }) });
  }
  return out;
}

/** The answer checked against what was asked; `roster` is every project, not only the list asked with. */
export function checkAnswer(answer: unknown, ask: PlanAsk, roster: readonly WordsPlace[]): Checked {
  const raw = rawCells(answer);
  if (raw === null) return { ok: false, failed: ["The answer isn't in the asked shape."] };
  const failed: string[] = [];
  const byNumber = new Map<number, RawCell>();
  for (const cell of raw) {
    if (!Number.isInteger(cell.cell) || cell.cell < 1 || cell.cell > ask.cells.length)
      failed.push(`There is no Cell ${cell.cell}.`);
    else if (byNumber.has(cell.cell)) failed.push(`Cell ${cell.cell} is answered twice.`);
    else byNumber.set(cell.cell, cell);
  }
  const cells: AnsweredCell[] = [];
  ask.cells.forEach((asked, i) => {
    const n = i + 1;
    const cell = byNumber.get(n);
    if (cell === undefined) return void failed.push(`Cell ${n} has no answer.`);
    const title = cell.title.trim();
    const prompt = cell.prompt.trim();
    if (title.length === 0) failed.push(`Cell ${n} has no title.`);
    else if (title.length > TITLE_MOST) failed.push(`Cell ${n}'s title is too long.`);
    if (prompt.length === 0) failed.push(`Cell ${n} has no prompt.`);
    const named = cell.project?.trim() ?? "";
    let project: WordsPlace | null = null;
    if (asked.place !== null) {
      if (named.length > 0 && named.toLowerCase() !== asked.place.toLowerCase())
        failed.push(`Cell ${n}'s place is set by the words; it takes no project.`);
    } else if (named.length === 0) {
      failed.push(`Cell ${n}'s place is open; name its project.`);
    } else {
      project = roster.find((place) => place.name.toLowerCase() === named.toLowerCase()) ?? null;
      if (project === null) failed.push(`"${named}" is no project here.`);
    }
    cells.push({ title, prompt, project });
  });
  const prompts = cells.map((cell) => cell.prompt);
  ask.verbatims
    .toSorted((a, b) => a.start - b.start)
    .forEach((verbatim, i) => {
      const holding = prompts.filter((prompt) => prompt.includes(verbatim.text.trim())).length;
      if (holding === 0) failed.push(`⟦P${i + 1}⟧ is in no prompt word for word.`);
      else if (holding > 1) failed.push(`⟦P${i + 1}⟧ is in more than one prompt.`);
    });
  for (const part of missingParts(ask, prompts))
    failed.push(`This part is in no prompt: "${part}"`);
  return failed.length > 0 ? { ok: false, failed } : { ok: true, cells };
}

const contentWords = (text: string) =>
  (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).filter(
    (word) => word.length >= 4 && !COMMON.has(word),
  );

/**
 * The sentences of the task whose words reached no prompt: a sentence
 * counts once half its telling words are in the prompts, so a prompt may
 * say it in its own way, but none is dropped.
 */
function missingParts(ask: PlanAsk, prompts: readonly string[]): string[] {
  let task = ask.task;
  for (const verbatim of ask.verbatims) task = task.replace(verbatim.text, " ");
  const said = new Set(prompts.flatMap(contentWords));
  return task
    .split(/[.!?;\n]+/)
    .map((part) => part.trim())
    .filter((part) => {
      const words = contentWords(part);
      return words.length > 0 && words.filter((word) => said.has(word)).length * 2 < words.length;
    });
}
