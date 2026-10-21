/**
 * A plan as the plan history keeps it (stemcells/tasks/prompting.md,
 * decision 19): the words, the facts, each call and the checks it failed,
 * the plan, and what came of it. It stays on this machine, in the app's own
 * data folder, for 30 days (`upstream/planner.ts`).
 */
import { cellWords, type Launch, type ReadoutDefaults } from "../cells";
import { type PlanAsk, withChips } from "./ask";
import type { Plan } from "./plan";
import type { Try } from "./think";

/** What came of a plan: it started (with ⌘↵ over a risky act: "anyway"), Esc dropped it, or the words changed. */
export type PlanOutcome = "started" | "anyway" | "dropped" | "changed";

export function planRecord(input: {
  readonly ask: PlanAsk;
  readonly tries: readonly Try[];
  readonly plan: Plan;
  readonly launch: Launch;
  readonly defaults: ReadoutDefaults;
  /** The risky acts it held for. */
  readonly risk: readonly string[];
  readonly outcome: PlanOutcome;
}): Record<string, unknown> {
  const { ask, plan } = input;
  const words = cellWords(input.launch, input.defaults);
  return {
    words: withChips(ask.text, ask.chips ?? []),
    cells: ask.cells,
    projects: ask.projects.map((project) => project.name),
    tries: input.tries,
    plan: {
      kind: plan.kind,
      ...(plan.why === undefined ? {} : { why: plan.why }),
      cells: plan.cells.map((cell, i) => ({
        model: words[i]?.model?.text ?? null,
        effort: words[i]?.effort?.text ?? null,
        place: cell.picked?.name ?? words[i]?.place?.text ?? null,
        picked: cell.picked !== null,
        title: cell.title,
        prompt: cell.prompt,
      })),
    },
    risk: input.risk,
    outcome: input.outcome,
  };
}
