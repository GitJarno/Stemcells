/**
 * The changes an update brings, as the desktop's updater writes them into
 * its notes (`apps/desktop/src/stemcells/updates/changes.ts`): a nightly per
 * day of merges, each item a merged pull request's title, then its number.
 */

/** How many changes the notes hold: every one, listed or not. */
export function updateChangeCount(state: {
  readonly releaseNotes: ReadonlyArray<{ readonly totalItems: number }>;
}): number {
  return state.releaseNotes.reduce((count, note) => count + note.totalItems, 0);
}

/**
 * "7", "42+", "99+": the badge stays one small shape, and says "+" when
 * upstream's notes left older nightlies out of the count.
 */
export function changeCountLabel(count: number, more: boolean): string {
  return count > 99 ? "99+" : more ? `${count}+` : String(count);
}
