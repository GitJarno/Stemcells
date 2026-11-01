// Where Add to Chat's bar sits. The bar is pinned to the foot of the card's
// content, and on the phone that content has been seen laid out taller than the
// sheet shows at its part-height detent, with the bar below the screen.

interface Sheet {
  /** The card's height as laid out. */
  readonly height: number;
  /** The detent the sheet rests at, as a fraction of its tallest. */
  readonly fraction: number;
  /** The card's height at the tallest detent, once seen there. */
  readonly tallest: number | undefined;
  /** The window's height. */
  readonly window: number;
  /** The window's safe-area insets, top and bottom. */
  readonly top: number;
  readonly bottom: number;
}

/** How far the bar rises from the content's foot, so it sits at the foot the sheet shows. */
export function footLift(sheet: Sheet): number {
  const { height, fraction, bottom } = sheet;
  // UIKit: a detent's value is a height above the bottom inset, a fraction of the tallest one's.
  const shows = (tallest: number) => fraction * (tallest - bottom) + bottom;
  if (sheet.tallest !== undefined) {
    // Shorter than the tallest is content following the sheet, at rest or mid-drag.
    return height < sheet.tallest - 1 ? 0 : Math.max(0, height - shows(sheet.tallest));
  }
  // Not yet seen at the top: no taller than this detent shows on the whole window is following it.
  if (height <= shows(sheet.window)) return 0;
  return Math.max(0, height - shows(Math.min(height, sheet.window - sheet.top)));
}
