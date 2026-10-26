/**
 * The cards' keyboard walk (stemcells/tasks/aski-forward.md, Move 2, slice D): ↓ from Aski's
 * empty composer, then ↓ and ↑ by number, Esc back. A step lands on the card's recommendation,
 * so Enter takes it; never on an option that allows, and on the card itself when it recommends
 * nothing. Focus in the list holds it still (NeedsFrame), so nothing moves under it.
 */

/** A card that still takes an answer. */
const OPEN = "[data-stemcells-need][data-open]";
const LIST = "[data-stemcells-needs-list]";
const FRAME = "[data-stemcells-needs-frame]";

/** Where a step onto a card lands. */
function landingOf(card: HTMLElement): HTMLElement {
  return (
    card.querySelector<HTMLElement>(
      "[data-need-option][data-recommended]:not([data-allows], :disabled)",
    ) ?? card
  );
}

/** Puts the focus on a card where a step onto it lands. */
export function land(card: HTMLElement): void {
  landingOf(card).focus();
}

/** Steps from the card holding `from` to the next open one, or the one before; false when there is none. */
export function step(from: Element, by: 1 | -1): boolean {
  const here = from.closest("[data-stemcells-need]");
  const list = from.closest(LIST);
  if (here === null || list === null) return false;
  const open = [...list.querySelectorAll<HTMLElement>(OPEN)];
  const at = open.indexOf(here as HTMLElement);
  const next =
    at === -1
      ? // The card closed: the open ones after it, or before it, in the list's order.
        by === 1
        ? open.find((card) => here.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING)
        : open.findLast(
            (card) => here.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_PRECEDING,
          )
      : open[at + by];
  if (next === undefined) return false;
  land(next);
  return true;
}

/** Steps onto the first open card in the frame around `from`; false when there is none. */
export function enter(from: Element): boolean {
  const card = from.closest(FRAME)?.querySelector<HTMLElement>(`${LIST} ${OPEN}`);
  if (card == null) return false;
  land(card);
  return true;
}

/** Back to Aski's composer in the frame around `from`. */
export function leave(from: Element): void {
  from
    .closest(FRAME)
    ?.querySelector<HTMLElement>("[data-stemcells-needs-main] [contenteditable='true']")
    ?.focus();
}

/**
 * Before a card takes an answer: when the keyboard gave it, the focus steps
 * on to the next open card, or back to the composer after the last, so it
 * isn't lost with the option it was on.
 */
export function answering(card: HTMLElement | null): void {
  if (card === null || card.querySelector(":focus-visible") === null) return;
  if (!step(card, 1)) leave(card);
}
