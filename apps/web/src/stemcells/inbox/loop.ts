/**
 * Input, the inbox (stemcells/tasks/inbox.md): the queue and the loop through it, as plain
 * steps both the Mac and the phone run (`apps/mobile/src/stemcells/line/kit.ts`). A Cell is in
 * the queue while it asks and answered once its ask leaves, however it was answered. Each
 * reading hands the loop the queue and the open chat; the loop says what to open next.
 */

/** Input's order: the longest waiting first, a Cell with no time last; a tie by key. */
export function byWaiting<T>(
  cells: ReadonlyArray<T>,
  keyOf: (cell: T) => string,
  sinceOf: (cell: T) => string | null | undefined,
): T[] {
  const at = (cell: T) => {
    const ms = Date.parse(sinceOf(cell) ?? "");
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
  };
  // The phone's Hermes has no toSorted.
  return [...cells].sort((a, b) => {
    const order = at(a) - at(b);
    if (order !== 0 && !Number.isNaN(order)) return order;
    const [ka, kb] = [keyOf(a), keyOf(b)];
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** When each Cell began to wait on the person: its oldest open ask, by Cell. */
export function waitingSince(
  asks: Iterable<{ readonly cell: string; readonly since: string }>,
): Map<string, string> {
  const since = new Map<string, string>();
  for (const ask of asks) {
    const before = since.get(ask.cell);
    if (before === undefined || ask.since < before) since.set(ask.cell, ask.since);
  }
  return since;
}

/**
 * Input (decisions 1, 2 and 10), the same on the Mac and the phone: the awake Cells with an ask
 * open, by their oldest (`waitingSince`), the longest waiting first.
 */
export const inputOf = <T>(
  awake: ReadonlyArray<T>,
  keyOf: (cell: T) => string,
  since: ReadonlyMap<string, string>,
): T[] =>
  byWaiting(
    awake.filter((cell) => since.has(keyOf(cell))),
    keyOf,
    (cell) => since.get(keyOf(cell)),
  );

/** One going through Input: from the first ask the person met there to the last answered. */
export interface Clearing {
  readonly startedAt: number;
  /** Every Cell the queue held during it. */
  readonly met: ReadonlySet<string>;
}

/**
 * How the last clearing ended, for Input's empty page until the person turns away: the Cells
 * it went through (those awake now are flying again; the rest were put off or slept) and how
 * long it took.
 */
export interface Cleared {
  readonly cells: ReadonlySet<string>;
  readonly ms: number;
}

export interface Loop {
  /**
   * What the queue was read over (a project; the phone's picks and the machines it has read):
   * another is a new start, not a step, so a Cell leaving with it was never answered.
   */
  readonly view: string | null;
  /** The queue as the last reading had it. */
  readonly queue: ReadonlyArray<string>;
  /** The Cell the loop follows: opened from Input, while the person stays on it. */
  readonly following: string | null;
  /** The loop opened `following`, which hasn't shown yet: meanwhile `from`, open then, shows. */
  readonly landing: boolean;
  readonly from: string | null;
  /** Input was entered beside the list before its first view: its top opens once that comes. */
  readonly awaiting: boolean;
  readonly clearing: Clearing | null;
  readonly cleared: Cleared | null;
}

export const LOOP_AT_REST: Loop = {
  view: null,
  queue: [],
  following: null,
  landing: false,
  from: null,
  awaiting: false,
  clearing: null,
  cleared: null,
};

export interface Step {
  readonly loop: Loop;
  /** The Cell to open now, in place of the chat open (beside the list, or the whole screen). */
  readonly open: string | null;
  /** The last ask of a clearing just left: the all-clear's moment. */
  readonly allClear: boolean;
}

/** What a reading hands the loop. */
export interface Reading {
  /** What the queue is read over (`Loop.view`); null until it has been read. */
  readonly view: string | null;
  /** Input's Cells, longest waiting first (`byWaiting`). */
  readonly queue: ReadonlyArray<string>;
  /** The Cell whose chat is open (beside the list, or over it), or null. */
  readonly open: string | null;
  /** Input is the stage on show. */
  readonly onInput: boolean;
  readonly now: number;
}

/**
 * Turning to Input (decision 3): where a chat stands beside the list (`beside`), the top Cell
 * opens and the loop follows it, once the queue has been read; where the list is the whole
 * screen, nothing opens on its own.
 */
export function entered(loop: Loop, reading: Reading, beside: boolean): Step {
  const step = read(loop, { ...reading, onInput: true });
  if (reading.view === null) return { ...step, loop: { ...step.loop, awaiting: beside } };
  return beside ? openTop(step, reading.open) : step;
}

function openTop(step: Step, open: string | null): Step {
  const top = step.loop.queue[0] ?? null;
  if (top === null) return step;
  const landing = top !== open;
  return {
    ...step,
    loop: { ...step.loop, following: top, landing, from: landing ? open : null },
    open: landing ? top : null,
  };
}

/** The person opened `cell` from Input's list: the loop follows it. */
export const opened = (loop: Loop, cell: string): Loop =>
  !loop.queue.includes(cell) || (loop.following === cell && !loop.landing)
    ? loop
    : { ...loop, following: cell, landing: false, from: null };

/** The chat the loop chose couldn't open: it stops, rather than wait for it to land. */
export const unfollowed = (loop: Loop): Loop =>
  loop.following === null ? loop : { ...loop, following: null, landing: false, from: null };

/** Turning away from Input: the loop stops opening, and the all-clear line has been seen. */
export const left = (loop: Loop): Loop => ({
  ...loop,
  following: null,
  landing: false,
  from: null,
  awaiting: false,
  cleared: null,
});

/**
 * A reading (decision 5): the followed Cell's ask gone, the next opens in its place; the person
 * opening another chat stops the loop; the last ask leaving ends the clearing, once, with its
 * moment only on Input. Another view starts the loop afresh; an unread one leaves it as it is.
 */
export function read(loop: Loop, reading: Reading): Step {
  if (reading.view === null) return { loop, open: null, allClear: false };
  const step = reading.view === loop.view ? stepped(loop, reading) : afresh(reading);
  return loop.awaiting && reading.onInput ? openTop(step, reading.open) : step;
}

const afresh = ({ view, queue, onInput, now }: Reading): Step => ({
  loop: {
    ...LOOP_AT_REST,
    view,
    queue,
    clearing: onInput && queue.length > 0 ? { startedAt: now, met: new Set(queue) } : null,
  },
  open: null,
  allClear: false,
});

function stepped(loop: Loop, reading: Reading): Step {
  const { view, queue, open, now } = reading;
  const inQueue = new Set(queue);
  let clearing = loop.clearing;
  if (clearing === null && reading.onInput && queue.length > 0)
    clearing = { startedAt: now, met: new Set() };
  if (clearing !== null && queue.some((cell) => !clearing!.met.has(cell)))
    clearing = { ...clearing, met: new Set([...clearing.met, ...queue]) };
  let { following, landing, from } = loop;
  let opens: string | null = null;
  if (following !== null && landing) {
    // On its way: the chat that was open shows until it lands.
    if (open === following) landing = false;
    else if (open !== from) following = null;
  } else if (following !== null && open !== following) {
    following = null;
  }
  if (following === null) landing = false;
  if (following !== null && !landing && !inQueue.has(following)) {
    opens = queue[0] ?? null;
    landing = opens !== null;
    from = open;
    following = opens;
  }
  const ends = clearing !== null && queue.length === 0;
  const allClear = ends && reading.onInput;
  const after: Loop = {
    view,
    queue: sameCells(queue, loop.queue) ? loop.queue : queue,
    following: ends ? null : following,
    landing: !ends && landing,
    from: ends || following === null ? null : from,
    awaiting: false,
    clearing: ends ? null : clearing,
    cleared: allClear
      ? { cells: clearing!.met, ms: now - clearing!.startedAt }
      : queue.length > 0 || ends
        ? null
        : loop.cleared,
  };
  return { loop: sameLoop(after, loop) ? loop : after, open: opens, allClear };
}

const sameCells = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((cell, index) => cell === b[index]);

const sameLoop = (a: Loop, b: Loop) =>
  a.view === b.view &&
  a.queue === b.queue &&
  a.following === b.following &&
  a.landing === b.landing &&
  a.from === b.from &&
  a.awaiting === b.awaiting &&
  a.clearing === b.clearing &&
  a.cleared === b.cleared;
