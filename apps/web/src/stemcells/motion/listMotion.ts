/**
 * Every row of the Cells' lists, Mac and phone, moves in three ways only (stemcells/tasks/
 * sleep-motion.md): move, enter, leave. Plain numbers so the phone reads them too; each is a
 * token of `tokens/stemcells.css`, held there by `listMotion.test.ts`.
 */

/** `--sc-motion-recede`: an ease out, which never overshoots. */
const RECEDE = { duration: 350, easing: [0, 0, 0.58, 1] } as const;

export const LIST_MOTION = {
  /** A row gliding to its new slot, a row folding away, and a Cell flying to its count. */
  move: RECEDE,
  leave: RECEDE,
  /** A row fading in where it landed: `--sc-motion-fade`. */
  enter: { duration: 200, easing: [0, 0, 0.58, 1] },
  /** Its light rising over the row's own and going: up quickly, down slowly. */
  bloom: { rise: 250, fall: 650 },
  /** The count taking a Cell, one small bump: `--sc-motion-settle`'s length. */
  tick: { duration: 419 },
  /** More rows than this entering at once is a list read again (a pick, a page), not arrivals. */
  mostAtOnce: 4,
} as const;

export type Bezier = readonly [number, number, number, number];

/** A curve as CSS writes it. */
export const cssEasing = (easing: Bezier): string => `cubic-bezier(${easing.join(", ")})`;

/** A reading of a list: what it was a view of (the picks, the machines heard from), and its rows. */
export interface ListReading {
  readonly view: string;
  readonly keys: ReadonlySet<string>;
}

/**
 * The rows that entered a list since its reading `before`: none at its first reading or in
 * another view (the list read again), and none when more than `mostAtOnce` came at once.
 */
export function enteredRows(
  before: ListReading | null,
  view: string,
  after: ReadonlyArray<string>,
): string[] {
  if (before === null || before.view !== view) return [];
  const entered = after.filter((key) => !before.keys.has(key));
  return entered.length > LIST_MOTION.mostAtOnce ? [] : entered;
}
