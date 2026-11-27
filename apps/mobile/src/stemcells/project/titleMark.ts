// Where a project's mark stands over a title's first line (`home/RowCell.tsx`, `TitleMark`).

interface TypeMetrics {
  /** Where the capitals' top stands, over the type's size. */
  readonly cap: number;
  /** Where the baseline stands under its line's top, over the type's size (`hhea` ascender). */
  readonly ascent: number;
}

const DM_SANS: TypeMetrics = { cap: 0.7, ascent: 0.992 };

/**
 * Each face a title may wear, by the family name upstream's font preference gives `--font-sans`
 * (`lib/fontFamilies.ts`). DM Sans is read from its files (`upstream/titleFont.contract.test.ts`);
 * the system faces from their fonts' tables: iOS' San Francisco as UIFont reports it, Android's Roboto.
 */
export const TITLE_TYPE: Readonly<Record<string, TypeMetrics>> = {
  "DMSans-Regular": DM_SANS,
  System: { cap: 1443 / 2048, ascent: 1950 / 2048 },
  "sans-serif": { cap: 1456 / 2048, ascent: 1900 / 2048 },
};

/** The mark against the title's type: a quarter over its size, the gap after it half of it. */
const SIZE = 1.25;
const GAP = 0.5;

/**
 * The mark for a title set in `fontSize` of `family`, after the app's and the system's text sizes:
 * the room it takes on the first line, and where it stands from the line's top, its middle on the capitals'.
 */
export function titleMarkLayout(fontSize: number, family: unknown) {
  const type = (typeof family === "string" ? TITLE_TYPE[family] : undefined) ?? DM_SANS;
  const size = fontSize * SIZE;
  return {
    size,
    width: size + fontSize * GAP,
    top: fontSize * (type.ascent - type.cap / 2) - size / 2,
  };
}
