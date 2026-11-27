/**
 * The buttons of the ask a Cell's chat ends on (stemcells/tasks/the-ask.md, decisions 3 and 5):
 * the card's own options, less those that take words, which the composer answers.
 */
import { LATER, NOTHING_TO_DO, type Card, type CardOption } from "./card";

export interface AskButtons {
  /** The first button, drawn primary: never a settle or an allow. */
  readonly primary: CardOption | null;
  readonly rest: ReadonlyArray<CardOption>;
  /** Later: Not now. */
  readonly notNow: CardOption | null;
}

export function askButtonsOf(card: Card): AskButtons {
  const shown = card.options.filter((option) => option.words === null);
  const first = shown[0];
  const primary = first !== undefined && first.id !== NOTHING_TO_DO && !first.allows ? first : null;
  return {
    primary,
    rest: primary === null ? shown : shown.slice(1),
    notNow: card.later ? LATER : null,
  };
}
