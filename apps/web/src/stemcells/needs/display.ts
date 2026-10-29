/**
 * The cards on the page, from the newest list (stemcells/tasks/aski-room.md, decisions 3 and
 * 9). Cards never re-sort: a new one joins at the bottom. A card whose need is gone folds away
 * at once and leaves the list once it has (stemcells/tasks/unblocking.md, decision 7).
 */
import type { Need } from "./wire";

export interface Shown {
  readonly need: Need;
  /** When the need left the list; null while it is live. */
  readonly goneAt: number | null;
}

export function nextShown(
  previous: ReadonlyArray<Shown>,
  latest: ReadonlyArray<Need>,
  options: {
    readonly now: number;
    readonly linger: number;
    /** A gone card kept folded past its linger: an answer still on the undo line. */
    readonly keep?: (key: string) => boolean;
  },
): ReadonlyArray<Shown> {
  const byKey = new Map(latest.map((need) => [need.key, need]));
  const kept = previous.flatMap((shown): Shown[] => {
    const live = byKey.get(shown.need.key);
    if (live !== undefined) return [{ need: live, goneAt: null }];
    const goneAt = shown.goneAt ?? options.now;
    const leaving =
      options.now - goneAt >= options.linger && options.keep?.(shown.need.key) !== true;
    return leaving ? [] : [{ need: shown.need, goneAt }];
  });
  const seen = new Set(previous.map((shown) => shown.need.key));
  const arrivals = latest
    .filter((need) => !seen.has(need.key))
    .toSorted((a, b) => a.number - b.number)
    .map((need): Shown => ({ need, goneAt: null }));
  const next = [...kept, ...arrivals];
  const same =
    next.length === previous.length &&
    next.every((shown, index) => {
      const before = previous[index];
      return before !== undefined && before.need === shown.need && before.goneAt === shown.goneAt;
    });
  return same ? previous : next;
}

/** When the next gone card leaves the list; a kept one waits for what keeps it to change. */
export function nextLeaveAt(
  shown: ReadonlyArray<Shown>,
  linger: number,
  keep: (key: string) => boolean = () => false,
): number | null {
  const times = shown.flatMap((each) =>
    each.goneAt === null || keep(each.need.key) ? [] : [each.goneAt + linger],
  );
  return times.length === 0 ? null : Math.min(...times);
}

/**
 * A run of needs from the first this page saw until the list empties: how many
 * there were and how long they took, for the one line the column leaves
 * behind ("All clear · 4 answered in 1 min 12 s").
 */
export interface Episode {
  readonly startedAt: number;
  readonly keys: ReadonlySet<string>;
}

export function nextEpisode(
  episode: Episode | null,
  latest: ReadonlyArray<Need>,
  now: number,
): { readonly episode: Episode | null; readonly cleared: { count: number; ms: number } | null } {
  if (latest.length === 0) {
    return {
      episode: null,
      cleared: episode === null ? null : { count: episode.keys.size, ms: now - episode.startedAt },
    };
  }
  const keys = new Set(episode?.keys);
  for (const need of latest) keys.add(need.key);
  // From when this page first saw one: a limit from yesterday isn't an hour's work.
  return { episode: { startedAt: episode?.startedAt ?? now, keys }, cleared: null };
}

/** "1 min 12 s", "40 s", "2 h 5 min". */
export function spanOf(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return seconds % 60 === 0 ? `${minutes} min` : `${minutes} min ${seconds % 60} s`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

export function clearedLine(cleared: { count: number; ms: number }): string {
  return `All clear · ${cleared.count} answered in ${spanOf(cleared.ms)}`;
}
