// Where Add to Chat's bar sits. The bar is pinned to the foot of the card's content, and a sheet
// can lay that content out taller than it shows, past the window's bottom edge, which is the
// sheet's visible foot. Measured, not modelled from the detent: on the Duo's windows, and when a
// scroll moved the sheet to its other detent, a model put the bar mid-card.

/** How far the bar rises from the content's foot, so it sits at the window's bottom edge. */
export function footLift(card: {
  /** The card's top and height in the window, as measured. */
  readonly top: number;
  readonly height: number;
  /** The window's height. */
  readonly window: number;
}): number {
  return Math.max(0, card.top + card.height - card.window);
}
