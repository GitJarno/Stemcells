/**
 * How tall a chat's terminal drawer opens when the person hasn't dragged it:
 * about ten rows, a prompt and a short scrollback, so the chat keeps the
 * pane. Never more than 30% of the pane, never fewer than six rows.
 */

export const DRAWER_ROWS = 10;
export const DRAWER_MIN_ROWS = 6;
export const DRAWER_MAX_PANE_SHARE = 0.3;

export interface DrawerMeasure {
  /** One terminal row, in px, from the terminal's font. */
  readonly rowHeight: number;
  /** What the drawer holds besides its rows: its edge, the buttons' row, the grid's padding. */
  readonly chrome: number;
  /** The pane the drawer opens in; null outside a pane. */
  readonly paneHeight: number | null;
}

export function defaultDrawerHeight(measure: DrawerMeasure): number {
  const rows = (count: number) => Math.ceil(measure.chrome + count * measure.rowHeight);
  const cap =
    measure.paneHeight === null
      ? Number.POSITIVE_INFINITY
      : Math.floor(measure.paneHeight * DRAWER_MAX_PANE_SHARE);
  return Math.max(rows(DRAWER_MIN_ROWS), Math.min(rows(DRAWER_ROWS), cap));
}
