// Where a project's mark stands over a title's first line (`home/RowCell.tsx`, `TitleMark`).

/** DM Sans' capitals stand 0.7 of its size (`capHeight` 700 of 1000 units, in every weight). */
export const DM_SANS_CAP = 0.7;

/** DM Sans' baseline stands 0.992 of its size under its line's top (`hhea` ascender). */
export const DM_SANS_ASCENT = 0.992;

/** The mark against the title's type: a quarter over its size, the gap after it half of it. */
const SIZE = 1.25;
const GAP = 0.5;

/**
 * The mark for a title set in `fontSize`, after the app's and the system's text sizes: the room
 * it takes on the first line, and where it stands from the line's top, its middle on the capitals'.
 */
export function titleMarkLayout(fontSize: number) {
  const size = fontSize * SIZE;
  return {
    size,
    width: size + fontSize * GAP,
    top: fontSize * (DM_SANS_ASCENT - DM_SANS_CAP / 2) - size / 2,
  };
}
