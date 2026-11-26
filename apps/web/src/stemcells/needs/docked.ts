/**
 * The buttons of the ask docked over a Cell's composer (stemcells/tasks/the-ask.md, decisions 3,
 * 5 and 7): the card's own options, less those that take words, which the composer below answers.
 */
import { LATER, NOTHING_TO_DO, type Card, type CardOption } from "./card";
import type { NeedKind, NeedsList } from "./wire";

export interface DockedButtons {
  /** The first button, which Return takes: never a settle or an allow. */
  readonly primary: CardOption | null;
  readonly rest: ReadonlyArray<CardOption>;
  /** Later: Not now. */
  readonly notNow: CardOption | null;
}

export function dockedButtonsOf(card: Card): DockedButtons {
  const shown = card.options.filter((option) => option.words === null);
  const first = shown[0];
  const primary = first !== undefined && first.id !== NOTHING_TO_DO && !first.allows ? first : null;
  return {
    primary,
    rest: primary === null ? shown : shown.slice(1),
    notNow: card.later ? LATER : null,
  };
}

/** What upstream's panels over the composer answer (`inChat.ts`): its keys are theirs then. */
const PANEL_KINDS: ReadonlySet<NeedKind> = new Set(["permission", "question", "input"]);

/** Whether the composer's Return is free for the docked card: no panel of upstream's asks. */
export function dockedKeysFree(list: NeedsList | null, threadId: string): boolean {
  return !list?.needs.some((need) => need.threadId === threadId && PANEL_KINDS.has(need.kind));
}
