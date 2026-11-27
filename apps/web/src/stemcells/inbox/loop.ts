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
  /** The queue as the last reading had it. */
  readonly queue: ReadonlyArray<string>;
  /** The Cell the loop follows: opened from Input, while the person stays on it. */
  readonly following: string | null;
  /** What was open when the loop opened `following`, until the open chat is `following`. */
  readonly from: string | null;
  readonly clearing: Clearing | null;
  readonly cleared: Cleared | null;
}

export const LOOP_AT_REST: Loop = {
  queue: [],
  following: null,
  from: null,
  clearing: null,
  cleared: null,
};

export interface Step {
  readonly loop: Loop;
  /** The Cell to open now, in place of the chat open (beside the list, or the whole screen). */
  readonly open: string | null;
  /** The last ask of a clearing just left: the sky's sunrise. */
  readonly allClear: boolean;
}

/** What a reading hands the loop. */
export interface Reading {
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
 * opens and the loop follows it; where the list is the whole screen, nothing opens on its own.
 */
export function entered(loop: Loop, reading: Reading, beside: boolean): Step {
  const step = read(loop, { ...reading, onInput: true });
  const top = step.loop.queue[0] ?? null;
  if (!beside || top === null) return step;
  const from = top === reading.open ? null : reading.open;
  return {
    ...step,
    loop: { ...step.loop, following: top, from },
    open: from === null ? null : top,
  };
}

/** The person opened `cell` from Input's list: the loop follows it. */
export const opened = (loop: Loop, cell: string): Loop =>
  loop.queue.includes(cell) ? { ...loop, following: cell, from: null } : loop;

/** Turning away from Input: the loop stops opening, and the all-clear line has been seen. */
export const left = (loop: Loop): Loop => ({ ...loop, following: null, from: null, cleared: null });

/**
 * A reading (decision 5): the followed Cell's ask gone, the next opens in its place; the person
 * opening another chat stops the loop; the last ask leaving ends the clearing, once.
 */
export function read(loop: Loop, reading: Reading): Step {
  const { queue, open, now } = reading;
  const inQueue = new Set(queue);
  let clearing = loop.clearing;
  if (clearing === null && reading.onInput && queue.length > 0)
    clearing = { startedAt: now, met: new Set() };
  if (clearing !== null && queue.some((cell) => !clearing!.met.has(cell)))
    clearing = { ...clearing, met: new Set([...clearing.met, ...queue]) };
  let { following, from } = loop;
  let next: string | null = null;
  if (following !== null && from !== null) {
    // On its way: the chat that was open shows until it lands.
    if (open === following) from = null;
    else if (open !== from) following = null;
  } else if (following !== null && open !== following) {
    following = null;
  }
  if (following !== null && from === null && !inQueue.has(following)) {
    next = queue[0] ?? null;
    from = next === null ? null : following;
    following = next;
  }
  const allClear = clearing !== null && queue.length === 0;
  return {
    loop: {
      queue,
      following: allClear ? null : following,
      from: allClear ? null : from,
      clearing: allClear ? null : clearing,
      cleared: allClear
        ? { cells: clearing!.met, ms: now - clearing!.startedAt }
        : queue.length > 0
          ? null
          : loop.cleared,
    },
    open: next,
    allClear,
  };
}

/** How far through the clearing: answered of all it met, for the sky's dawn; null outside one. */
export function progressOf(loop: Loop): { readonly done: number; readonly of: number } | null {
  if (loop.clearing === null) return null;
  const of = loop.clearing.met.size;
  return { done: of - loop.queue.length, of };
}
