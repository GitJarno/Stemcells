/**
 * The cards Aski may take for the person once they've granted it
 * (stemcells/tasks/aski-autonomy.md): only those whose recommendation is one
 * fixed answer a later turn can take back. Pure: the service hands it cards
 * and messages.
 */
import type { Need } from "../needs/derive.ts";

export const KINDS = ["retry", "goAhead", "implement"] as const;
export type Kind = (typeof KINDS)[number];

/** The words each card sends, as the room's options send them (the web's `needs/card.ts`). */
export const PHRASES = { retry: "Try that again.", goAhead: "Go ahead." } as const;

/** Upstream's "Implement": what its plan card sends before the plan (the web's `proposedPlan.ts`). */
export const PLAN_PREFIX = "PLEASE IMPLEMENT THIS PLAN:\n";

/**
 * Words naming what is never Aski's to answer: a deploy, a merge, a release,
 * something deleted, or money or messages leaving. A card that says one is
 * the person's every time, and its take never counts.
 */
const NOT_REVERSIBLE =
  /\b(?:deploy\w*|merg(?:e|es|ed|ing)|releas(?:e|es|ing)|publish\w*|production|delet(?:e|es|ing)|drop(?:s|ped|ping)?|truncat\w*|wip(?:e|es|ing)|force[- ]push\w*|rm -rf|migrat\w*|purchas\w*|payments?|outreach|e-?mails?)\b/i;

/** The kind of card `need` is, or null when it is never Aski's to take. */
export function kindOf(need: Need): Kind | null {
  // A subagent's card is its parent's to answer.
  if (need.parentThreadId !== null) return null;
  switch (need.kind) {
    case "failed": {
      const errorClass = need.failure?.errorClass;
      return errorClass === "transport_error" || errorClass === "provider_error" ? "retry" : null;
    }
    case "prose":
      return need.prose?.cue === "stopped" && !NOT_REVERSIBLE.test(need.prose.text)
        ? "goAhead"
        : null;
    case "plan": {
      const plan = need.plan;
      return plan?.id != null && plan.markdown != null && !NOT_REVERSIBLE.test(plan.markdown)
        ? "implement"
        : null;
    }
    default:
      return null;
  }
}

/** Whether the person's message to a Cell was the recommendation of its `kind` of card. */
export function tookIt(kind: Kind, text: string): boolean {
  return kind === "implement" ? text.startsWith(PLAN_PREFIX) : text.trim() === PHRASES[kind];
}
