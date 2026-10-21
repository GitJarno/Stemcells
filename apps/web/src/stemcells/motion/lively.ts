/**
 * The lively budget: the one store every rare beat on screen draws from,
 * Aski's moments and the Cells' rare beats alike. About three an hour,
 * never the same beat twice in a row within the hour, and none at all
 * while anything waits on the person. It is kept in local storage, so every
 * window of the app spends from one budget.
 */

/** At most `perHour` rare beats in any `hour` of milliseconds. */
export const RARE = { perHour: 3, hour: 3_600_000 } as const;

const STORAGE_KEY = "stemcells.lively";

/** One rare beat played: which, and when (Unix milliseconds). */
interface Played {
  readonly id: string;
  readonly at: number;
}

/** Where the budget is kept: local storage in the page, anything alike in a test. */
export interface Ledger {
  read(): string | null;
  write(value: string): void;
}

const local: Ledger = {
  read: () => {
    try {
      return typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  write: (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage refused: the beat still plays, and this window forgets it.
    }
  },
};

/** The beats played in the hour before `now`, oldest first; what was kept and can't be read counts as none. */
function playedIn(ledger: Ledger, now: number): Played[] {
  try {
    const kept: unknown = JSON.parse(ledger.read() ?? "[]");
    if (!Array.isArray(kept)) return [];
    return kept.filter(
      (p): p is Played =>
        typeof p?.id === "string" &&
        typeof p?.at === "number" &&
        p.at <= now &&
        now - p.at < RARE.hour,
    );
  } catch {
    return [];
  }
}

/**
 * Asks for a rare beat: `id` may play at `now` when nothing waits on the
 * person, fewer than `RARE.perHour` played in the last hour, and the last of
 * them wasn't `id`. When it may, it is spent and this says true.
 */
export function takeRare(id: string, now: number, waits: boolean, ledger: Ledger = local): boolean {
  if (waits) return false;
  const played = playedIn(ledger, now);
  if (played.length >= RARE.perHour || played.at(-1)?.id === id) return false;
  ledger.write(JSON.stringify([...played, { id, at: now }]));
  return true;
}
