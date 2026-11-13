// @effect-diagnostics globalDate:off - a day and a night are the machine's own calendar's, and the phone reads this file too.

// The feats a crew earns: what every Cell on one machine has done together, worked out from the
// ledger's facts when asked and never stored, so a feat added later is awarded for the past
// too. A count only goes up: nothing breaks or drains (`stemcells/tasks/collection.md`).
// Pure, and safe for the phone's Hermes: no `toSorted`, no `Intl`.

import type { Fact } from "./facts.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How rarely a feat is earned, said plainly. A secret one shows nothing until it is. */
export type Rarity = "common" | "rare" | "legendary" | "secret";

/** What a feat unlocks: an outfit of the earned pack (`outfit:earned/<id>`), or an act (`act/<id>`). */
export type Reward =
  | { readonly kind: "piece"; readonly id: string }
  | { readonly kind: "act"; readonly id: string };

/**
 * What a feat counts. Each is one number that only grows as facts are read in the order they
 * happened: a count, or the most yet seen.
 */
export type Measure =
  /** Runs landed. */
  | "landings"
  /** Pull requests merged. */
  | "merges"
  /** Cells born. */
  | "cells"
  /** Cells settled. */
  | "settled"
  /** The longest a run that landed with Done worked on its own, asked nothing, in ms. */
  | "alone"
  /** The most runs in flight at one moment. */
  | "crew"
  /** The most landings in one day of the machine's calendar. */
  | "day"
  /** Landings between midnight and five by the machine's clock. */
  | "night"
  /** The most landings in a row with Done and nothing asked. */
  | "quiet"
  /** Providers Cells were born on. */
  | "drivers"
  /** Runs that landed with Done inside a minute. */
  | "quick"
  /** Pull requests merged within an hour of their Cell's birth. */
  | "straight"
  /** The most landings in one life. */
  | "life"
  /** Whole days since the first Cell was born. */
  | "days"
  /** Something the person's hand did, told by a screen the first time (`Deed`). */
  | "dazed"
  | "tossed"
  | "stroked";

/** What a screen tells the server it saw the person do, once each. */
export const DEEDS = ["dazed", "tossed", "stroked"] as const;
export type Deed = (typeof DEEDS)[number];

/** Where a feat belongs: what the crew gets done, how far a Cell goes alone, how much flies at once. */
export type Segment = "flight" | "trust" | "crew";
export const SEGMENTS: ReadonlyArray<Segment> = ["flight", "trust", "crew"];

/** Each measure's segment; none for one only a secret feat reads. */
const SEGMENT_OF: Readonly<Record<Measure, Segment | null>> = {
  landings: "flight",
  merges: "flight",
  settled: "flight",
  alone: "trust",
  quiet: "trust",
  straight: "trust",
  quick: "trust",
  crew: "crew",
  day: "crew",
  cells: "crew",
  life: "crew",
  drivers: "crew",
  days: "crew",
  night: null,
  dazed: null,
  tossed: null,
  stroked: null,
};

export interface Feat {
  readonly id: string;
  readonly measure: Measure;
  /** What the measure must reach. */
  readonly of: number;
  readonly rarity: Rarity;
  readonly reward: Reward;
  /** Its segment; null for a secret, which belongs to none and counts in no total. */
  readonly segment: Segment | null;
}

const piece = (id: string): Reward => ({ kind: "piece", id });
const act = (id: string): Reward => ({ kind: "act", id });
const feat = (measure: Measure, of: number, rarity: Rarity, reward: Reward, id?: string): Feat => ({
  id: id ?? `${measure}-${of}`,
  measure,
  of,
  rarity,
  reward,
  segment: rarity === "secret" ? null : SEGMENT_OF[measure],
});

/**
 * Every feat, in the order the collection shows them. The feats of one measure are a ladder,
 * the lowest first: a count that piles up climbs by tens, a best yet by twos and threes, the
 * first rung inside a crew's first day and the top about a year out for a heavy one
 * (`stemcells/tasks/collection.md`, The slopes). Every rung unlocks something.
 */
export const FEATS: ReadonlyArray<Feat> = [
  feat("landings", 1, "common", piece("rosette")),
  feat("landings", 10, "common", act("bow")),
  feat("landings", 100, "common", piece("medal")),
  feat("landings", 1_000, "rare", piece("laurel")),
  feat("landings", 10_000, "rare", act("flip")),
  feat("landings", 50_000, "legendary", piece("mantle")),
  feat("merges", 1, "common", piece("pennant")),
  feat("merges", 10, "common", act("robot")),
  feat("merges", 100, "rare", piece("cowboy")),
  feat("merges", 1_000, "rare", piece("tophat")),
  feat("merges", 5_000, "legendary", act("fireworks")),
  feat("settled", 10, "common", act("sweep")),
  feat("settled", 100, "rare", piece("fedora")),
  feat("settled", 1_000, "legendary", piece("firefighter")),
  feat("alone", 10 * MINUTE, "common", piece("headphones"), "alone-10"),
  feat("alone", 30 * MINUTE, "rare", piece("shades"), "alone-30"),
  feat("alone", HOUR, "rare", act("levitate"), "alone-60"),
  feat("alone", 2 * HOUR, "legendary", piece("titlebelt"), "alone-120"),
  feat("quiet", 5, "common", piece("specs")),
  feat("quiet", 15, "rare", piece("graduate")),
  feat("quiet", 30, "legendary", piece("wizard")),
  feat("straight", 1, "rare", act("rocket")),
  feat("quick", 1, "common", act("dash")),
  feat("crew", 3, "common", act("juggle")),
  feat("crew", 6, "rare", piece("captain")),
  feat("crew", 12, "legendary", piece("jetpack")),
  feat("day", 10, "common", act("punch")),
  feat("day", 100, "rare", piece("propeller")),
  feat("day", 500, "legendary", piece("viking")),
  feat("cells", 10, "common", piece("sprout")),
  feat("cells", 100, "common", piece("antennae")),
  feat("cells", 1_000, "rare", piece("astronaut")),
  feat("cells", 5_000, "legendary", piece("crown")),
  feat("life", 50, "rare", piece("flatcap")),
  feat("drivers", 3, "rare", piece("scarf")),
  feat("days", 30, "common", piece("beret")),
  feat("days", 365, "legendary", piece("angel")),
  feat("night", 1, "secret", piece("nightcap")),
  feat("dazed", 1, "secret", piece("plaster")),
  feat("tossed", 1, "secret", piece("eyepatch")),
  feat("stroked", 1, "secret", piece("hatchling")),
];

/** The id a reward's piece is worn by: an outfit of the earned pack. */
export const wornIdOf = (reward: Reward): string | undefined =>
  reward.kind === "piece" ? `outfit:earned/${reward.id}` : undefined;

/** When a feat was earned, and the Cell whose fact did it (none for one no single Cell did). */
export interface Earned {
  readonly at: string;
  readonly threadId: string | null;
}

/** A feat as it stands: how far along, and whether earned. */
export interface FeatState {
  readonly id: string;
  /** How far the measure has come; past `of` once the feat is earned. */
  readonly have: number;
  readonly of: number;
  readonly earned: Earned | null;
}

/** A deed told to the server: when, and the Cell it was done to. */
export interface DeedTold {
  readonly at: string;
  readonly threadId: string | null;
}

/** A time on the machine's own calendar: its day (`2027-02-06`) and its hour, 0 to 23. */
export interface Local {
  readonly day: string;
  readonly hour: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A time on the calendar of the machine this runs on. */
function localOf(ms: number): Local {
  const date = new Date(ms);
  return {
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    hour: date.getHours(),
  };
}

/** One number that only grows, and when it first reached each mark a feat names. */
class Tally {
  value = 0;
  readonly reached = new Map<number, Earned>();
  private readonly marks: number[];

  constructor(marks: ReadonlyArray<number>) {
    this.marks = [...marks].sort((a, b) => a - b);
  }

  /** Takes the number up to `to`, when that is more than it was. */
  raise(to: number, at: string, threadId: string | null): void {
    if (to <= this.value) return;
    for (const mark of this.marks) {
      if (mark > to) break;
      if (mark > this.value) this.reached.set(mark, { at, threadId });
    }
    this.value = to;
  }
}

const NIGHT_ENDS = 5;
const QUICK_MS = MINUTE;
const STRAIGHT_MS = HOUR;

interface Timed {
  readonly ms: number;
  readonly fact: Fact;
}

/**
 * Every feat as it stands at `now`, from `facts` in any order and the deeds told. `local` is
 * the machine's calendar, for the feats that name a day or a night.
 */
export function featsOf(
  facts: ReadonlyArray<Fact>,
  deeds: Readonly<Partial<Record<Deed, DeedTold>>>,
  now: number,
  local: (ms: number) => Local = localOf,
): FeatState[] {
  const tallies = new Map<Measure, Tally>();
  const tally = (measure: Measure): Tally => {
    let known = tallies.get(measure);
    if (known === undefined) {
      known = new Tally(FEATS.filter((f) => f.measure === measure).map((f) => f.of));
      tallies.set(measure, known);
    }
    return known;
  };

  const timed: Timed[] = [];
  for (const fact of facts) {
    const ms = Date.parse(fact.at);
    if (!Number.isNaN(ms)) timed.push({ ms, fact });
  }
  timed.sort((a, b) => a.ms - b.ms);

  const born = new Map<string, number>();
  const drivers = new Set<string>();
  const settled = new Set<string>();
  const lives = new Map<string, number>();
  const days = new Map<string, number>();
  let quiet = 0;
  let first: number | null = null;
  const flights: { readonly from: number; readonly to: number; readonly threadId: string }[] = [];

  for (const { ms, fact } of timed) {
    const { at, threadId } = fact;
    switch (fact.kind) {
      case "born": {
        first ??= ms;
        born.set(threadId, ms);
        tally("cells").raise(born.size, at, threadId);
        if (fact.data.driver !== null) drivers.add(fact.data.driver);
        tally("drivers").raise(drivers.size, at, threadId);
        break;
      }
      case "landed": {
        const { ms: ran, aloneMs, asks, closeOut } = fact.data;
        const clean = closeOut === "done" && asks === 0;
        tally("landings").raise(tally("landings").value + 1, at, threadId);
        if (clean) tally("alone").raise(aloneMs, at, threadId);
        quiet = clean ? quiet + 1 : 0;
        tally("quiet").raise(quiet, at, threadId);
        if (closeOut === "done" && ran > 0 && ran < QUICK_MS)
          tally("quick").raise(tally("quick").value + 1, at, threadId);
        const life = (lives.get(threadId) ?? 0) + 1;
        lives.set(threadId, life);
        tally("life").raise(life, at, threadId);
        const when = local(ms);
        const today = (days.get(when.day) ?? 0) + 1;
        days.set(when.day, today);
        tally("day").raise(today, at, threadId);
        if (when.hour < NIGHT_ENDS) tally("night").raise(tally("night").value + 1, at, threadId);
        if (ran > 0) flights.push({ from: ms - ran, to: ms, threadId });
        break;
      }
      case "settled": {
        settled.add(threadId);
        tally("settled").raise(settled.size, at, threadId);
        break;
      }
      case "merged": {
        tally("merges").raise(tally("merges").value + 1, at, threadId);
        const birth = born.get(threadId);
        if (birth !== undefined && ms - birth <= STRAIGHT_MS)
          tally("straight").raise(tally("straight").value + 1, at, threadId);
        break;
      }
    }
  }

  // The most runs in flight at once: each run's start and landing in the order they happened,
  // a landing before a start at the same moment, so one that follows another isn't beside it.
  const edges = flights.flatMap((flight) => [
    { ms: flight.from, step: 1, threadId: flight.threadId },
    { ms: flight.to, step: -1, threadId: flight.threadId },
  ]);
  edges.sort((a, b) => a.ms - b.ms || a.step - b.step);
  let aloft = 0;
  for (const edge of edges) {
    aloft += edge.step;
    if (edge.step > 0) tally("crew").raise(aloft, new Date(edge.ms).toISOString(), edge.threadId);
  }

  if (first !== null) {
    const since = Math.floor((now - first) / DAY);
    for (const each of FEATS) {
      if (each.measure !== "days" || since < each.of) continue;
      tally("days").raise(each.of, new Date(first + each.of * DAY).toISOString(), null);
    }
    tally("days").raise(since, new Date(now).toISOString(), null);
  }

  for (const deed of DEEDS) {
    const told = deeds[deed];
    if (told !== undefined) tally(deed).raise(1, told.at, told.threadId);
  }

  return FEATS.map((each) => {
    const counted = tally(each.measure);
    return {
      id: each.id,
      have: counted.value,
      of: each.of,
      earned: counted.reached.get(each.of) ?? null,
    };
  });
}

/** The day so far on the machine's calendar: what landed, merged and was born, and who landed. */
export interface Today {
  readonly day: string;
  readonly landings: number;
  readonly merges: number;
  readonly cells: number;
  /** The longest a run that landed today worked on its own, in ms. */
  readonly aloneMs: number;
  /** The Cells that landed today, by thread id, the first to land first. */
  readonly landed: ReadonlyArray<string>;
}

/** No more Cells than this are listed as the day's: a line of them, not a census. */
const MOST_LANDED = 24;

export function todayOf(
  facts: ReadonlyArray<Fact>,
  now: number,
  local: (ms: number) => Local = localOf,
): Today {
  const { day } = local(now);
  let landings = 0;
  let merges = 0;
  let cells = 0;
  let aloneMs = 0;
  const landed: { readonly ms: number; readonly threadId: string }[] = [];
  const seen = new Set<string>();
  const timed: Timed[] = [];
  for (const fact of facts) {
    const ms = Date.parse(fact.at);
    // A day is at most 25 hours long: anything older can't be today's.
    if (!Number.isNaN(ms) && now - ms < 25 * HOUR && local(ms).day === day)
      timed.push({ ms, fact });
  }
  timed.sort((a, b) => a.ms - b.ms);
  for (const { ms, fact } of timed) {
    if (fact.kind === "merged") merges += 1;
    else if (fact.kind === "born") cells += 1;
    else if (fact.kind === "landed") {
      landings += 1;
      aloneMs = Math.max(aloneMs, fact.data.aloneMs);
      if (!seen.has(fact.threadId)) {
        seen.add(fact.threadId);
        landed.push({ ms, threadId: fact.threadId });
      }
    }
  }
  return {
    day,
    landings,
    merges,
    cells,
    aloneMs,
    landed: landed.slice(0, MOST_LANDED).map((each) => each.threadId),
  };
}

/** What the person keeps beside the feats: what each Cell wears by their choice, and the feats they have been shown. */
export interface Kept {
  /** By thread id: the ids worn, each an unlocked reward's (`wornIdOf`). */
  readonly worn: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly seen: ReadonlyArray<string>;
}

/** `GET /api/stemcells/collection`, as the server sends it. */
export interface Collection extends Kept {
  readonly feats: ReadonlyArray<FeatState>;
  readonly today: Today;
  /** Whether every chat made before the ledger was has been read into it: until then, counts may still rise. */
  readonly backfilled: boolean;
}

/** `POST /api/stemcells/collection`: one change. */
export type CollectionChange =
  /** Dress the Cell `threadId` in `worn`; none gives it back its own look. */
  | { readonly wear: { readonly threadId: string; readonly worn: ReadonlyArray<string> } }
  /** These feats have been shown to the person. */
  | { readonly seen: ReadonlyArray<string> }
  /** The person did this, to the Cell `threadId`. */
  | { readonly deed: { readonly deed: Deed; readonly threadId: string | null } };

/** The worn ids the feats earned so far unlock. */
export function unlockedPieces(feats: ReadonlyArray<FeatState>): Set<string> {
  const earned = new Set(feats.filter((f) => f.earned !== null).map((f) => f.id));
  const ids = new Set<string>();
  for (const each of FEATS) {
    const id = wornIdOf(each.reward);
    if (id !== undefined && earned.has(each.id)) ids.add(id);
  }
  return ids;
}

/** The acts the feats earned so far unlock, by act name. */
export function unlockedActs(feats: ReadonlyArray<FeatState>): Set<string> {
  const earned = new Set(feats.filter((f) => f.earned !== null).map((f) => f.id));
  return new Set(
    FEATS.flatMap((each) =>
      each.reward.kind === "act" && earned.has(each.id) ? [each.reward.id] : [],
    ),
  );
}

/** Every act a feat unlocks, earned or not: an act named here plays only once its feat is earned. */
export const FEAT_ACTS: ReadonlySet<string> = new Set(
  FEATS.flatMap((each) => (each.reward.kind === "act" ? [each.reward.id] : [])),
);
