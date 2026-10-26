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

/** One thing an update makes better: what changed, in the pull request's own words, and its number. */
export interface Better {
  readonly title: string;
  readonly number: number | null;
}

const NUMBERED = /^(.*\S)\s+\(#(\d+)\)$/u;

/** What the update brings, newest first, each once: the notes' items, read back into title and number. */
export function bettersOf(state: {
  readonly releaseNotes: ReadonlyArray<{ readonly items: ReadonlyArray<string> }>;
}): ReadonlyArray<Better> {
  const seen = new Set<string>();
  const betters: Better[] = [];
  for (const note of state.releaseNotes) {
    for (const item of note.items.toReversed()) {
      const numbered = NUMBERED.exec(item.trim());
      const better = numbered
        ? { title: numbered[1]!, number: Number(numbered[2]) }
        : { title: item.trim(), number: null };
      const key = better.number === null ? better.title : `#${better.number}`;
      if (better.title === "" || seen.has(key)) continue;
      seen.add(key);
      betters.push(better);
    }
  }
  return betters;
}
