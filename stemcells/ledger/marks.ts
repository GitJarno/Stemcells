// The marks a Cell earns in its own life, worked out from the ledger's facts each time they are
// asked for and never stored: a mark added later is awarded for the past too. Each is earned
// once a life and says what shows it. The time thresholds are growth's own stages.
// Pure, and safe for the phone's Hermes: no `toSorted`, no `Intl`.

import { GROWN_MS } from "./alone.ts";
import type { Fact } from "./facts.ts";

/** A run that long on its own earns Landed alone: the time growth's first stage takes. */
export const LANDED_ALONE_MS = GROWN_MS.nubs;
/** That long on its own in one life earns Long haul: growth's last stage, made durable. */
export const LONG_HAUL_MS = GROWN_MS.biceps;

/** That many landings in one life earn Frequent flyer. */
export const FREQUENT_FLYER = 10;
/** That many landings in a row with Done, asking the person nothing, earn Radio silence. */
export const RADIO_SILENCE = 5;
/** That many pull requests merged in one life earn Hat-trick. */
export const HAT_TRICK = 3;

/** A mark one life earned, when it earned it, and what shows it. */
export type Award =
  /** A run landed with Done, asked the person nothing, and worked `aloneMs` on its own. */
  | {
      readonly mark: "landed-alone";
      readonly threadId: string;
      readonly at: string;
      readonly aloneMs: number;
    }
  /** Its pull request `number` merged. */
  | {
      readonly mark: "merged";
      readonly threadId: string;
      readonly at: string;
      readonly number: number;
    }
  /** Its landed runs came to `aloneMs` on their own, past the long haul at `at`. */
  | {
      readonly mark: "long-haul";
      readonly threadId: string;
      readonly at: string;
      readonly aloneMs: number;
    }
  /** It landed `landings` times, the tenth at `at`. */
  | {
      readonly mark: "frequent-flyer";
      readonly threadId: string;
      readonly at: string;
      readonly landings: number;
    }
  /** Its longest run of clean landings is `inARow`; the fifth in a row landed at `at`. */
  | {
      readonly mark: "radio-silence";
      readonly threadId: string;
      readonly at: string;
      readonly inARow: number;
    }
  /** `merges` of its pull requests merged, the third at `at`. */
  | {
      readonly mark: "hat-trick";
      readonly threadId: string;
      readonly at: string;
      readonly merges: number;
    };

export type MarkId = Award["mark"];

/** Every mark a life can earn, in the order a record lists them: the nearest first. */
export const MARKS: ReadonlyArray<MarkId> = [
  "landed-alone",
  "merged",
  "frequent-flyer",
  "radio-silence",
  "hat-trick",
  "long-haul",
];

type Rule = (threadId: string, facts: ReadonlyArray<Fact>) => Award | null;

/** The first run that did it stands for the mark: later ones don't move it. */
const landedAlone: Rule = (threadId, facts) => {
  for (const fact of facts) {
    if (
      fact.kind === "landed" &&
      fact.data.closeOut === "done" &&
      fact.data.asks === 0 &&
      fact.data.aloneMs >= LANDED_ALONE_MS
    ) {
      return { mark: "landed-alone", threadId, at: fact.at, aloneMs: fact.data.aloneMs };
    }
  }
  return null;
};

const merged: Rule = (threadId, facts) => {
  for (const fact of facts) {
    if (fact.kind === "merged") {
      return { mark: "merged", threadId, at: fact.at, number: fact.data.number };
    }
  }
  return null;
};

/** Earned at the landing that took it past the long haul; it shows all its time alone since. */
const longHaul: Rule = (threadId, facts) => {
  let alone = 0;
  let at: string | null = null;
  for (const fact of facts) {
    if (fact.kind !== "landed") continue;
    alone += fact.data.aloneMs;
    if (at === null && alone >= LONG_HAUL_MS) at = fact.at;
  }
  return at === null ? null : { mark: "long-haul", threadId, at, aloneMs: alone };
};

const frequentFlyer: Rule = (threadId, facts) => {
  let landings = 0;
  let at: string | null = null;
  for (const fact of facts) {
    if (fact.kind !== "landed") continue;
    landings += 1;
    if (landings === FREQUENT_FLYER) at = fact.at;
  }
  return at === null ? null : { mark: "frequent-flyer", threadId, at, landings };
};

/** Clean as the crew's count is (`feats.ts`): landed with Done and asked nothing. */
const radioSilence: Rule = (threadId, facts) => {
  let row = 0;
  let best = 0;
  let at: string | null = null;
  for (const fact of facts) {
    if (fact.kind !== "landed") continue;
    row = fact.data.closeOut === "done" && fact.data.asks === 0 ? row + 1 : 0;
    best = Math.max(best, row);
    if (at === null && row >= RADIO_SILENCE) at = fact.at;
  }
  return at === null ? null : { mark: "radio-silence", threadId, at, inARow: best };
};

const hatTrick: Rule = (threadId, facts) => {
  let merges = 0;
  let at: string | null = null;
  for (const fact of facts) {
    if (fact.kind !== "merged") continue;
    merges += 1;
    if (merges === HAT_TRICK) at = fact.at;
  }
  return at === null ? null : { mark: "hat-trick", threadId, at, merges };
};

const RULES: ReadonlyArray<Rule> = [
  landedAlone,
  merged,
  longHaul,
  frequentFlyer,
  radioSilence,
  hatTrick,
];

const byTime = (a: { readonly at: string }, b: { readonly at: string }) =>
  a.at < b.at ? -1 : a.at > b.at ? 1 : 0;

/** The marks each life earned, by its thread id, each life's in the order it earned them. */
export function marksByThread(facts: ReadonlyArray<Fact>): Map<string, Award[]> {
  const lives = new Map<string, Fact[]>();
  for (const fact of facts) {
    const life = lives.get(fact.threadId);
    if (life === undefined) lives.set(fact.threadId, [fact]);
    else life.push(fact);
  }
  const marks = new Map<string, Award[]>();
  for (const [threadId, life] of lives) {
    life.sort(byTime);
    const earned: Award[] = [];
    for (const rule of RULES) {
      const award = rule(threadId, life);
      if (award !== null) earned.push(award);
    }
    if (earned.length > 0) marks.set(threadId, earned.sort(byTime));
  }
  return marks;
}

/** `GET /api/stemcells/collection/cells`: the marks the Cells asked for earned, by thread id; a Cell with none isn't listed. */
export interface CellRecords {
  readonly marks: Readonly<Record<string, ReadonlyArray<Award>>>;
}

/** The most Cells one read of their records asks for. */
export const MOST_RECORDS = 24;
