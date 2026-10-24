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
 * What every take adds to the card's own words: the boundary the person set
 * when they granted it. A word list can't tell what is final; the Cell
 * reading this can, and stops for the person there.
 */
export const BOUNDARY =
  "Stop and ask me before anything final: a deploy, a merge, a release, deleting something, or spending or sending anything.";

/**
 * A card whose own ask is plainly final stays the person's, boundary or
 * not: a deploy, a merge or a landing, a release, a forced or main-branch
 * push, a deletion of what isn't code, an install of the app, money spent,
 * or a message sent. Only the ask is read (a Cell's stop, a plan, what a
 * retry repeats), not the whole run, whose code and talk name these words
 * in passing ("the merge conflicts", "the deployment docs").
 */
const FINAL = new RegExp(
  [
    String.raw`\bdeploy(?:s|ed|ing)?\b`,
    String.raw`\bmerg(?:e|es|ed|ing)\b(?! ?\()(?! conflicts?\b)`,
    String.raw`\b(?:land|ship)(?:s|ping|ing)? (?:it|this|them|that|the (?:pr|pull request|change|branch|fix)|#\d+)\b`,
    String.raw`\b(?:land|squash|push)\w* (?:\w+ )?(?:to|on|in|into) (?:origin |the )?(?:main|master)\b|\bpush\w* (?:origin )?(?:main|master)\b`,
    String.raw`\breleas(?:e|es|ing) (?:it|this|v?\d)|\bcut (?:the |a )?release\b|\bpush\w* (?:the )?tags?\b`,
    String.raw`\bpublish(?:es|ed|ing)?\b`,
    String.raw`\b(?:to|in|on|into) (?:the )?(?:prod|production)\b|\bproduction (?:database|db|server|data)\b`,
    String.raw`\bforce[- ]push\w*|--force\b|\bpush\w* -f\b`,
    String.raw`\brm -\w*[rf]|\brm (?:the |-\w+ )|\breset --hard\b|\bclean -\w*f|\bbranch -D\b`,
    String.raw`\b(?:remov|delet|drop|wip|purg|destroy|reset|clean|clear)\w* (?:up |out |away )?(?:the |its |this |that |all |every |any |old )?(?:\w+ ){0,2}(?:worktrees?|branch(?:es)?|repo(?:sitor(?:y|ies))?|folders?|director(?:y|ies)|databases?|db|tables?|isos?|simulators?|volumes?|backups?|accounts?)\b`,
    String.raw`\b(?:truncat\w*|wip(?:e|es|ing)|purg(?:e|es|ing)|destroy\w*|overwrit\w*|uninstall\w*)\b`,
    String.raw`\binstall(?:s|ing)? (?:the |it|this )?(?:app|update|build)\b|\binstall-app\b`,
    String.raw`\b(?:purchas\w*|pay for|buy(?:s|ing)?|spend(?:s|ing)? (?:money|\$))\b`,
    String.raw`\b(?:send|email|message|tweet|dm)(?:s|ed|ing)? (?:it |them |this |the |an? |to )?(?:\w+ ){0,2}(?:e-?mails?|messages?|customers?|users?|clients?|team|channel|slack)\b|\bpost(?:s|ed|ing)? (?:it |this )?(?:in|to|on) \S+|\boutreach\b`,
  ].join("|"),
  "i",
);

/** Whether a card's ask names nothing plainly final. */
export const reversible = (ask: string): boolean => !FINAL.test(ask);

/** Words that only carry a Cell on, or only agree: what they mean is in what came before. */
const CARRY_ON =
  /^(?:continue\b.*|go ahead\.?|try that again\.?|carry on\.?|done\. carry on\.?)$/is;
const SHORT = 40;

/**
 * What a retry repeats, read from the Cell's conversation newest first:
 * every message back to the newest request of the person's own. A "Go
 * ahead." or a "Yes, do it." means what the Cell's reply before it offered,
 * so that reply is part of the ask.
 */
export function askOf(
  newestFirst: ReadonlyArray<{ readonly role: "user" | "assistant"; readonly text: string }>,
): string {
  const ask: string[] = [];
  for (const message of newestFirst) {
    ask.push(message.text);
    const text = message.text.trim();
    if (message.role === "user" && !CARRY_ON.test(text) && text.length > SHORT) break;
  }
  return ask.join("\n\n");
}

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
      return need.prose?.cue === "stopped" && reversible(need.prose.text) ? "goAhead" : null;
    case "plan": {
      const plan = need.plan;
      return plan?.id != null && plan.markdown != null && reversible(plan.markdown)
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
