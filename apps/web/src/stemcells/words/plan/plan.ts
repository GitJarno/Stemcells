/**
 * A plan: the Cells a message starts once Aski filled what the words left
 * open (stemcells/tasks/prompting.md, decisions 11 and 12), or the floor
 * when it couldn't.
 */
import { cellWords, type Launch, type Readout, type ReadoutDefaults, readoutOf } from "../cells";
import type { WordsPlace } from "../places";
import type { CellGroup, Facts } from "../read";
import { type AskProject, MOST_PROJECTS, type PlanAsk } from "./ask";
import type { AnsweredCell } from "./check";

export interface PlannedCell {
  /** The words' group: the Cell's model, effort and place, as they set them. */
  readonly group: CellGroup;
  /** The project Aski picked for an open Cell; null when the words set the place. */
  readonly picked: WordsPlace | null;
  readonly title: string;
  /** Its first message. */
  readonly prompt: string;
}

export interface Plan {
  readonly cells: readonly PlannedCell[];
  /** Aski's checked answer, or the floor: the Cells as the words set them, each with the whole task. */
  readonly kind: "planned" | "floor";
  /** Why the floor came back, as the readout says it. */
  readonly why?: string;
}

/**
 * What the planner is asked for `launch`: each Cell's words read back, its
 * place open or set. `written` is the message with its code as written and
 * its chips' words (`ComposerWords`); the reader's text blanks them.
 */
export function askOf(
  facts: Facts,
  launch: Launch,
  defaults: ReadoutDefaults,
  projects: readonly AskProject[],
  written: { readonly text: string; readonly chips: readonly string[] } = {
    text: facts.text,
    chips: [],
  },
): PlanAsk {
  const words = cellWords(launch, defaults);
  return {
    text: written.text,
    chips: written.chips,
    task: facts.task,
    verbatims: facts.verbatims,
    cells: launch.cells.map(({ group }, i) => ({
      model: words[i]!.model?.text ?? null,
      effort: words[i]!.effort?.text ?? null,
      place: group.open ? null : (words[i]!.place?.text ?? null),
    })),
    projects,
  };
}

/** The checked answer joined to the facts it was asked for. */
export function joined(launch: Launch, answered: readonly AnsweredCell[]): Plan {
  return {
    kind: "planned",
    cells: launch.cells.map(({ group }, i) => ({
      group,
      picked: answered[i]!.project,
      title: answered[i]!.title,
      prompt: answered[i]!.prompt,
    })),
  };
}

/**
 * The floor: every Cell the words set, each with the whole task, open places
 * left to the person. It never starts by itself, and never folds N Cells
 * into one.
 */
export function floorOf(launch: Launch, task: string, why: string): Plan {
  const n = launch.cells.length;
  return {
    kind: "floor",
    why,
    cells: launch.cells.map(({ group }, i) => ({
      group,
      picked: null,
      title: `Cell ${i + 1} of ${n}`,
      prompt: task,
    })),
  };
}

/** Whether the person checks the plan before any Cell starts: Aski picked a place, or it's the floor. */
export function needsCheck(plan: Plan): boolean {
  return plan.kind === "floor" || plan.cells.some((cell) => cell.picked !== null);
}

/**
 * The projects an open Cell may go to, as the planner reads them: the ones
 * the words mention first, then the most recently worked in, at most
 * `MOST_PROJECTS` (decision 11).
 */
export function shortlistOf(
  facts: Facts,
  places: readonly WordsPlace[],
  recency: (place: WordsPlace) => number,
): WordsPlace[] {
  const mentioned = facts.mentions.map((hit) => hit.place);
  const recent = places
    .filter((place) => recency(place) > 0)
    .toSorted((a, b) => recency(b) - recency(a));
  return [...new Set([...mentioned, ...recent])].slice(0, MOST_PROJECTS);
}

/** Whether Enter can start the plan: every Cell has its place. */
export function startable(plan: Plan): boolean {
  return plan.cells.every((cell) => cell.picked !== null || !cell.group.open);
}

/**
 * A plan waiting for a second Enter, read back: each Cell on its own once
 * Aski picked places, the place it picked in the accent (decision 12).
 */
export function readoutOfPlan(plan: Plan, launch: Launch, defaults: ReadoutDefaults): Readout {
  const base = readoutOf({ ...launch, held: false }, defaults);
  const words = cellWords(launch, defaults);
  const picked = plan.cells.some((cell) => cell.picked !== null);
  return {
    ...base,
    groups: picked
      ? plan.cells.map((cell, i) => ({
          ...words[i]!,
          count: null,
          ...(cell.picked ? { place: { text: cell.picked.name, mark: null, aski: true } } : {}),
        }))
      : base.groups,
    share: "",
    plan: { state: "check", why: plan.why ?? null, startable: startable(plan) },
  };
}

/** What the spawn calls each Cell of a plan, as `cellTitles` does: "Opus 5.5 · Harbor". */
export function planTitles(plan: Plan, launch: Launch, defaults: ReadoutDefaults): string[] {
  return cellWords(launch, defaults).map((words, i) =>
    [words.model?.text, plan.cells[i]?.picked?.name ?? words.place?.text]
      .filter(Boolean)
      .join(" · "),
  );
}

/**
 * The plan with the draft's own project first, where Aski sent a Cell of
 * the first one's words there: the draft is the first Cell, so it starts
 * where it stands instead of moving.
 */
export function ownFirst(plan: Plan, own: string | null): Plan {
  const first = plan.cells[0];
  if (own === null || !first?.picked || first.picked.id === own) return plan;
  const mine = plan.cells.findIndex(
    (cell) => cell.group === first.group && cell.picked?.id === own,
  );
  if (mine < 0) return plan;
  const cells = [...plan.cells];
  [cells[0], cells[mine]] = [cells[mine]!, first];
  return { ...plan, cells };
}
