// When each planned row arrives in Awake, and how its line settles there
// (stemcells/tasks/aski-orchestrator.md, decision 12): Cells come a stagger apart, at most four
// forming at once, and a line steps from glyphs to its words on the Cells' 12-a-second beat.
// Pure numbers, strings and timers, shared by the Mac and the phone.

import type { Planned } from "./planned.ts";

/** The glyphs a Cell condenses through, as the spawn's (`words/spawn/plan.ts`). */
const GLYPHS = [".", ":", "+", "#", "@"] as const;

/** One beat of the Cells' sprite clock, in ms: `--sc-timing-form-step`. */
export const ARRIVAL_BEAT_MS = 1000 / 12;

export const ARRIVALS = {
  /** Between two Cells arriving, ms: the row one pushes down has cleared its line by the next. */
  stagger: 150,
  /** The most forming at once: the next waits for the oldest to stand. */
  most: 4,
  /** How long a Cell forms before it has its own pixels, in beats: its glyphs, then its blocks. */
  forming: GLYPHS.length + 4,
  /** Beats from a row's landing to its line's first step: the row it pushed down has cleared it by then. */
  settles: 2,
  /** How long a started row's line says its name and model once its Cell is listed, ms: the plan's call back stands as long. */
  linger: 10_000,
  /** How long a started row waits for the machine to list its Cell before it gives up, ms. */
  giveUp: 60_000,
  /** Its birth words fading as they go, ms: the lists' leave (`motion/listMotion.ts`). */
  fade: 140,
  /** A row folding away, ms: the lists' move. */
  fold: 350,
} as const;

/**
 * When the next Cell arrives, given when those before it did (`arrived`, ascending, on any one
 * clock in ms): no sooner than `now`, a stagger after the last, and once the fourth before it
 * has formed.
 */
export function nextArrival(
  arrived: ReadonlyArray<number>,
  now: number,
  timing: { readonly stagger: number; readonly forming: number; readonly most: number } = {
    stagger: ARRIVALS.stagger,
    forming: ARRIVALS.forming * ARRIVAL_BEAT_MS,
    most: ARRIVALS.most,
  },
): number {
  const last = arrived[arrived.length - 1];
  const oldest = arrived[arrived.length - timing.most];
  return Math.max(
    now,
    last === undefined ? now : last + timing.stagger,
    oldest === undefined ? now : oldest + timing.forming,
  );
}

/** The steps a line settles in, one a beat: at this step every part reads its own words. */
export const DECODE_STEPS = 5;
/** The line settles in this many bands, left to right, each a step after the one before. */
const BANDS = 3;
/** The steps a character spends as a glyph before it is its letter. */
const RAMP = DECODE_STEPS - (BANDS - 1);

/** A character's grain, 0 to 2, the same each time: what scatters a band's glyphs (an integer hash's low bits). */
function grainAt(at: number): number {
  let mixed = Math.imul(at + 1, 0x9e3779b1);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x85ebca6b);
  mixed ^= mixed >>> 13;
  return (mixed >>> 0) % (GLYPHS.length - RAMP + 1);
}

/** What one part of a line shows at a step. */
export interface DecodedPart {
  /** Its words so far: those settled, then glyphs; nothing yet past them. */
  readonly text: string;
  /** How many of its characters, from the left, are its own already. */
  readonly settled: number;
  /** Whether anything of it shows yet. */
  readonly started: boolean;
}

/**
 * A line's `parts` (its name, its model, its title, in reading order) at `step` of its settle:
 * 0 as it starts, `DECODE_STEPS` when every character is its own. Each character waits, then
 * climbs the glyphs, then is its letter, the left of the line first; spaces stay spaces. What is
 * settled is always a prefix of the whole line, so no settled letter ever moves.
 */
export function decodeAt(parts: ReadonlyArray<string>, step: number): DecodedPart[] {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  let before = 0;
  return parts.map((part) => {
    let text = "";
    let settled = 0;
    for (let index = 0; index < part.length; index++) {
      const at = before + index;
      const band = Math.min(BANDS - 1, Math.floor((at * BANDS) / Math.max(1, total)));
      const since = step - band;
      if (since < 0) break;
      const char = part[index]!;
      if (since >= RAMP) {
        text += char;
        settled = index + 1;
      } else if (char === " ") text += char;
      // Denser each step, with a grain of its own so a band never reads as one glyph repeated.
      else text += GLYPHS[since + grainAt(at)];
    }
    before += part.length;
    return { text, settled, started: text.length > 0 || (part.length === 0 && step >= RAMP) };
  });
}

/** A row's model and effort as its chip says them: "Fable 5.2 · high". */
export const chipWords = (row: {
  readonly modelName: string;
  readonly effort?: string | undefined;
}): string =>
  row.effort === undefined || row.effort === ""
    ? row.modelName
    : `${row.modelName} · ${row.effort}`;

/** A planned row standing in Awake. */
export interface Arrival {
  readonly row: Planned;
  /** When it landed, on the clock its platform counts by (`ArrivalDeps`, `now`). */
  readonly at: number;
  /** Whether it forms and its line settles; else (Reduce Motion) it fades in. */
  readonly forms: boolean;
  /** `fading`: its birth words leave and its row stays; `gone`: its row folds away. */
  readonly state: "here" | "fading" | "gone";
}

/** How long a row waits for Aski's throw to be asked for before it arrives without one: a beat. */
const GRACE = ARRIVAL_BEAT_MS;
/** A row's birth words stay at least this long once the machine lists its Cell, ms. */
const LISTED_FOR = 3000;

export interface ArrivalDeps<From, Slot> {
  readonly now: () => number;
  readonly reduced: () => boolean;
  /** How long Aski's copy flies, ms. */
  readonly travel: () => number;
  readonly takeThrow: (threadId: string) => From | null;
  /** Where the next row lands: its Cell's box at the top of Awake; null while Awake is out of sight. */
  readonly slot: () => Slot | null;
  readonly ready: (from: From) => void;
  readonly playThrow: (from: From, to: Slot, threadId: string) => void;
  /** The Cell of a row that landed at `at` forms from then: its glyphs, then its blocks. */
  readonly forms: (threadId: string, at: number) => void;
  /** How long a listed row's birth words take to go, ms, where it isn't the lists' leave. */
  readonly fade?: number;
}

/** The arrivals of the planned rows `rows()` holds, told of each change by `sync`. */
export function createArrivals<From, Slot>(
  rows: () => ReadonlyArray<Planned>,
  deps: ArrivalDeps<From, Slot>,
) {
  const waiting = new Map<string, ReturnType<typeof setTimeout>>();
  const ending = new Map<string, ReturnType<typeof setTimeout>>();
  const arrivals = new Map<string, Arrival>();
  /** Rows whose birth is over while their plan still names them. */
  const over = new Set<string>();
  /** When the machine listed each arrived row's Cell. */
  const listed = new Map<string, number>();
  const landings: number[] = [];
  const listeners = new Set<() => void>();
  let shown: readonly Arrival[] = [];
  let coming: ReadonlySet<string> = new Set();

  const publish = () => {
    shown = [...arrivals.values()];
    if (coming.size !== waiting.size || [...waiting.keys()].some((id) => !coming.has(id)))
      coming = new Set(waiting.keys());
    for (const listener of listeners) listener();
  };
  const rowOf = (threadId: string) => rows().find((row) => row.threadId === threadId);
  const later = (threadId: string, run: () => void, ms: number) => {
    clearTimeout(ending.get(threadId));
    ending.set(threadId, setTimeout(run, Math.max(0, ms)));
  };

  /** The row leaves: its birth words when the machine lists its Cell, else all of it. */
  const leave = (threadId: string) => {
    const arrival = arrivals.get(threadId);
    if (arrival === undefined || arrival.state !== "here") return;
    const stays = listed.has(threadId);
    arrivals.set(threadId, { ...arrival, state: stays ? "fading" : "gone" });
    later(
      threadId,
      () => {
        arrivals.delete(threadId);
        listed.delete(threadId);
        ending.delete(threadId);
        if (rowOf(threadId) !== undefined) over.add(threadId);
        publish();
      },
      stays ? (deps.fade ?? ARRIVALS.fade) : ARRIVALS.fold,
    );
    publish();
  };

  /** A row gives up when the machine never lists it. */
  const expire = (threadId: string) => {
    const arrival = arrivals.get(threadId);
    if (arrival === undefined || arrival.state !== "here") return;
    const since = listed.get(threadId);
    if (since === undefined) later(threadId, () => leave(threadId), ARRIVALS.giveUp);
    else {
      const until = Math.max(arrival.at + ARRIVALS.linger, since + LISTED_FOR);
      later(threadId, () => leave(threadId), until - deps.now());
    }
  };

  const land = (threadId: string, forms: boolean) => {
    waiting.delete(threadId);
    const row = rowOf(threadId);
    if (row === undefined) return;
    const at = deps.now();
    if (forms) deps.forms(threadId, at);
    arrivals.set(threadId, { row, at, forms, state: "here" });
    expire(threadId);
    publish();
  };

  const launch = (threadId: string) => {
    if (rowOf(threadId) === undefined) {
      waiting.delete(threadId);
      return publish();
    }
    if (deps.reduced()) return land(threadId, false);
    const from = deps.takeThrow(threadId);
    const thrown = from !== null && deps.slot() !== null;
    const now = deps.now();
    const lead = thrown ? deps.travel() : 0;
    const lands = nextArrival(landings, now + lead);
    landings.push(lands);
    if (landings.length > ARRIVALS.most * 2) landings.shift();
    if (thrown) {
      deps.ready(from);
      setTimeout(
        () => {
          const to = deps.slot();
          if (to !== null && rowOf(threadId) !== undefined) deps.playThrow(from, to, threadId);
        },
        lands - lead - now,
      );
    }
    waiting.set(
      threadId,
      setTimeout(() => land(threadId, true), lands - now),
    );
  };

  return {
    /** The planned rows changed. */
    sync() {
      const planned = new Map(rows().map((row) => [row.threadId, row]));
      for (const threadId of over) if (!planned.has(threadId)) over.delete(threadId);
      let changed = false;
      for (const [threadId, timer] of waiting) {
        if (planned.has(threadId)) continue;
        clearTimeout(timer);
        waiting.delete(threadId);
        changed = true;
      }
      for (const [threadId, arrival] of arrivals) {
        const row = planned.get(threadId);
        if (row === undefined) {
          leave(threadId);
          continue;
        }
        if (row === arrival.row || arrival.state !== "here") continue;
        arrivals.set(threadId, { ...arrival, row });
        changed = true;
      }
      for (const threadId of planned.keys()) {
        if (arrivals.has(threadId) || waiting.has(threadId) || over.has(threadId)) continue;
        if (deps.reduced()) land(threadId, false);
        else {
          waiting.set(
            threadId,
            setTimeout(() => launch(threadId), GRACE),
          );
          changed = true;
        }
      }
      if (changed) publish();
    },
    /** The machine lists these Cells now: an arrived row among them keeps its birth words a while, then they go. */
    listed(threadIds: Iterable<string>) {
      for (const threadId of threadIds) {
        if (!arrivals.has(threadId) || listed.has(threadId)) continue;
        listed.set(threadId, deps.now());
        expire(threadId);
      }
    },
    /** The rows standing in Awake, in the order they landed; the same array until one changes. */
    read: () => shown,
    /** The threads whose rows are on their way: the machine's own row for one waits until it lands. */
    coming: () => coming,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
