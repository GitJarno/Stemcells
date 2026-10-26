/**
 * The chats with words in a composer, as the person's screens report them; a Cell with a draft
 * never carries on by itself. Each screen reports its whole list, again while it isn't empty, so
 * a closed window's list lapses. A sleeping Mac spends that wall time unreported: after a wake,
 * `standing` and `heard` say which screens to hear from again before a list is trusted.
 */

/**
 * A screen's list stands this long after its last report: past the minute a
 * hidden window's timers are held to (Chromium's intensive throttling), so a
 * hidden window's drafts keep holding.
 */
export const DRAFTS_LAST_MS = 150_000;
/** How often a screen with drafts reports again: well within `DRAFTS_LAST_MS`. */
export const DRAFTS_REPORT_EVERY_MS = 20_000;
/** At most this many chats in one report, and this many screens at once. */
export const DRAFTS_MAX_THREADS = 500;
export const DRAFTS_MAX_SCREENS = 32;

export interface Drafts {
  /** `screen`'s chats with a draft now, replacing its last report. */
  readonly report: (screen: string, threadIds: ReadonlyArray<string>, now: number) => void;
  /** Every chat some screen reported a draft in, within `DRAFTS_LAST_MS`. */
  readonly current: (now: number) => ReadonlySet<string>;
  /** The screens whose drafts stood at `at`. */
  readonly standing: (at: number) => ReadonlySet<string>;
  /** When `screen` last reported, its list or that it has none; null if never. */
  readonly heard: (screen: string) => number | null;
}

/** Drops the oldest entries past `max`. */
function cap<V>(map: Map<string, V>, max: number, at: (value: V) => number) {
  while (map.size > max) {
    const oldest = [...map].toSorted((a, b) => at(a[1]) - at(b[1]))[0];
    if (oldest === undefined) return;
    map.delete(oldest[0]);
  }
}

export function makeDrafts(): Drafts {
  const lists = new Map<string, { readonly threadIds: ReadonlySet<string>; readonly at: number }>();
  const heardAt = new Map<string, number>();
  const stands = (list: { readonly at: number }, at: number) =>
    list.at <= at && at - list.at <= DRAFTS_LAST_MS;
  return {
    report: (screen, threadIds, now) => {
      heardAt.set(screen, now);
      cap(heardAt, 2 * DRAFTS_MAX_SCREENS, (at) => at);
      if (threadIds.length === 0) {
        lists.delete(screen);
        return;
      }
      lists.set(screen, { threadIds: new Set(threadIds.slice(0, DRAFTS_MAX_THREADS)), at: now });
      cap(lists, DRAFTS_MAX_SCREENS, (list) => list.at);
    },
    current: (now) => {
      const all = new Set<string>();
      for (const list of lists.values()) {
        if (stands(list, now)) for (const id of list.threadIds) all.add(id);
      }
      return all;
    },
    standing: (at) =>
      new Set([...lists].filter(([, list]) => stands(list, at)).map(([screen]) => screen)),
    heard: (screen) => heardAt.get(screen) ?? null,
  };
}
