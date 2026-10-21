/**
 * The words set up the draft they're typed in: its project, its model and
 * its effort follow them, so upstream's hero and pickers show what will
 * run and its send sends it. The text is the one truth:
 *
 * - A word acts once it is done (decision 5): something follows it, the
 *   caret left it, or the person paused.
 * - Deleting the word puts back what the draft had before the words set it.
 * - Picking from the hero or a picker while a word sets that thing
 *   rewrites the word: the pick goes into the text, not around it.
 *
 * This file decides; `ComposerWords` does. `stemcells/tasks/prompting.md`,
 * decisions 2, 5 and 14.
 */

import type { EffortHit, ModelHit } from "./models";
import type { PlaceHit } from "./places";
import type { Facts } from "./read";
import type { Span } from "./text";

/** What the words set for the one Cell they start; null when they start several. */
export interface Choice {
  readonly place: PlaceHit | null;
  readonly model: ModelHit | null;
  readonly effort: EffortHit | null;
}

export function choiceOf(facts: Facts): Choice | null {
  if (facts.cell !== null || facts.open || facts.cells.length !== 1) return null;
  const group = facts.groups[facts.cells[0]!.group]!;
  return { place: group.place, model: group.model, effort: group.effort };
}

/**
 * A word is done when something other than more of it follows, or the caret
 * isn't at its end, or the person paused: "Harbo" at the caret waits, so
 * the draft never moves mid-word.
 */
export function isDone(text: string, span: Span, caret: number, paused: boolean): boolean {
  if (paused || caret !== span.end) return true;
  const next = text[span.end];
  return next !== undefined && !/[\p{L}\p{N}.'’-]/u.test(next);
}

/** A model as the draft holds it: the provider instance, the model, its effort. */
export interface ModelKey {
  readonly instanceId: string;
  readonly model: string;
  /** In what the words want, null means they name no effort. */
  readonly effort: string | null;
}

/** Whether the draft's model is what the words want: an effort they don't name is the draft's own. */
export const fits = (current: ModelKey | null, want: ModelKey) =>
  current !== null &&
  current.instanceId === want.instanceId &&
  current.model === want.model &&
  (want.effort === null || current.effort === want.effort);

/** What the words want, resolved against the projects and the catalog. "wait" while a word isn't done. */
export interface Want {
  readonly project: { readonly key: string; readonly word: Span } | null | "wait";
  readonly model: { readonly to: ModelKey; readonly word: Span } | null | "wait";
}

/** What the draft has now. */
export interface Current {
  readonly project: string | null;
  readonly model: ModelKey | null;
}

/** What the words took over, with what was there before, to put back. */
export interface Taken<Own> {
  readonly project: { readonly own: string | null; readonly set: string } | null;
  readonly model: { readonly own: Own; readonly set: ModelKey } | null;
}

export type Step<Own> =
  /** Point the draft at a project; `word` flies to the hero. */
  | { readonly kind: "move"; readonly to: string; readonly word: Span | null }
  /** Set the draft's model; `word` flies to the picker. */
  | { readonly kind: "model"; readonly to: ModelKey; readonly word: Span | null }
  | { readonly kind: "restore-model"; readonly own: Own }
  /** The person picked a project while a word set it: the word becomes the pick. */
  | { readonly kind: "rewrite-project"; readonly word: Span; readonly to: string }
  /** The person picked a model or an effort while words set it. */
  | { readonly kind: "rewrite-model"; readonly to: ModelKey };

/**
 * The steps that bring the draft and the words together. `own` reads the
 * draft's model as it is, the moment the words first take it over.
 */
export function follow<Own>(
  taken: Taken<Own>,
  want: Want,
  current: Current,
  own: () => Own,
): { readonly taken: Taken<Own>; readonly steps: Step<Own>[] } {
  const steps: Step<Own>[] = [];
  let project = taken.project;
  let model = taken.model;

  const p = want.project;
  if (p === null) {
    if (project) steps.push({ kind: "move", to: project.own ?? project.set, word: null });
    project = null;
  } else if (p !== "wait") {
    if (project === null || project.set !== p.key) {
      if (project !== null && current.project !== project.set && current.project !== null) {
        // The draft moved under a word that names a place: the person picked.
        steps.push({ kind: "rewrite-project", word: p.word, to: current.project });
        project = { own: project.own, set: current.project };
      } else {
        if (current.project !== p.key) steps.push({ kind: "move", to: p.key, word: p.word });
        project = { own: project?.own ?? current.project, set: p.key };
      }
    } else if (current.project !== null && current.project !== project.set) {
      steps.push({ kind: "rewrite-project", word: p.word, to: current.project });
      project = { own: project.own, set: current.project };
    }
  }

  const m = want.model;
  if (m === null) {
    if (model) steps.push({ kind: "restore-model", own: model.own });
    model = null;
  } else if (m !== "wait") {
    if (model !== null && current.model !== null && !fits(current.model, model.set)) {
      // A pick from the model or effort picker while words set the model.
      steps.push({ kind: "rewrite-model", to: current.model });
      model = { own: model.own, set: current.model };
    } else if (!fits(current.model, m.to)) {
      steps.push({ kind: "model", to: m.to, word: m.word });
      model = { own: model?.own ?? own(), set: m.to };
    } else if (model === null || model.set !== m.to) {
      model = { own: model?.own ?? own(), set: m.to };
    }
  }
  return { taken: { project, model }, steps };
}
