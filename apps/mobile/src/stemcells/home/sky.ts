// The night's colours over Settled (`Night.tsx`), apart from its
// views so the header can colour Aski's eyes by the sky behind them.

/** The sky at the header's top, and at its deepest, `DEEP_AT` of the way down; past that it fades into the screen. */
export const TOP = [2, 3, 10] as const;
export const DEEP = [14, 16, 38] as const;
export const DEEP_AT = 0.72;

export const hex = (rgb: ReadonlyArray<number>) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** The sky's colour `at` a share of the way down the header, above where it fades. */
export function skyAt(at: number): string {
  const t = Math.min(1, Math.max(0, at / DEEP_AT));
  return hex(TOP.map((c, n) => c + (DEEP[n]! - c) * t));
}

/** The text and Aski's body over the night. */
export const NIGHT_INK = "#E8EDF1";
export const NIGHT_TEXT = "#CDCAC5";
