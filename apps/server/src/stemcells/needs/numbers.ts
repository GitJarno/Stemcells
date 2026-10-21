/**
 * Card numbers are addresses (stemcells/tasks/aski-room.md, decision 3).
 * A card keeps its number while it lives; a new one takes the next number;
 * numbering starts again at 1 only when the list empties. "For 2" then
 * means the same Cell on every screen, however long the person spoke.
 */

export interface Numbering {
  readonly next: number;
  readonly byKey: ReadonlyMap<string, number>;
}

export const EMPTY_NUMBERING: Numbering = { next: 1, byKey: new Map() };

/** Numbers the live keys: kept ones keep theirs, new ones follow in order of arrival. */
export function renumber(
  previous: Numbering,
  live: ReadonlyArray<{ readonly key: string; readonly since: number }>,
): Numbering {
  if (live.length === 0) return EMPTY_NUMBERING;
  const byKey = new Map<string, number>();
  const arrivals: Array<{ readonly key: string; readonly since: number }> = [];
  for (const item of live) {
    const kept = previous.byKey.get(item.key);
    if (kept === undefined) arrivals.push(item);
    else byKey.set(item.key, kept);
  }
  let next = previous.next;
  for (const item of arrivals.toSorted((a, b) => a.since - b.since || a.key.localeCompare(b.key))) {
    byKey.set(item.key, next++);
  }
  return { next, byKey };
}
