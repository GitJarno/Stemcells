/**
 * What autonomy keeps between runs of the server: how many times in a row
 * the person took each kind's recommendation, the kinds they granted, the
 * kinds they turned down, and the cards they kept for themselves. Pure.
 */
import * as Schema from "effect/Schema";

import { KINDS, type Kind } from "./kinds.ts";

/** Takes in a row before Aski offers to take that kind from then on. */
export const OFFER_AFTER = 5;
/** Kept cards remembered; older ones are long gone from the list. */
const KEPT_MAX = 200;

const KindSchema = Schema.Literals(KINDS);

export const Standing = Schema.Struct({
  streaks: Schema.Struct({ retry: Schema.Int, goAhead: Schema.Int, implement: Schema.Int }),
  granted: Schema.Array(KindSchema),
  /**
   * When each granted kind was granted: only cards that came after it are
   * taken. Missing from a file written before it existed (`loaded`).
   */
  grantedAt: Schema.optionalKey(Schema.Record(Schema.String, Schema.Number)),
  /** Turned down: "Not now" on the offer, or switched off. Never offered again. */
  declined: Schema.Array(KindSchema),
  /** Cards the person kept from a take, by key: never taken for them. */
  kept: Schema.Array(Schema.String),
});
export type Standing = typeof Standing.Type;

export const INITIAL: Standing = {
  streaks: { retry: 0, goAhead: 0, implement: 0 },
  granted: [],
  grantedAt: {},
  declined: [],
  kept: [],
};

/** A standing as read: a kind granted with no time of its own counts from now. */
export const loaded = (standing: Standing, now: number): Standing => {
  const grantedAt = { ...standing.grantedAt };
  for (const kind of standing.granted) grantedAt[kind] ??= now;
  return { ...standing, grantedAt };
};

const without = (kinds: ReadonlyArray<Kind>, kind: Kind) => kinds.filter((k) => k !== kind);
const adding = (kinds: ReadonlyArray<Kind>, kind: Kind) =>
  kinds.includes(kind) ? kinds : [...kinds, kind];

/** A card of `kind` left: the person took its recommendation, or did something else. */
export const counted = (standing: Standing, kind: Kind, took: boolean): Standing => ({
  ...standing,
  streaks: { ...standing.streaks, [kind]: took ? standing.streaks[kind] + 1 : 0 },
});

/** The kinds Aski offers to take now: five in a row, and never granted or turned down. */
export const offers = (standing: Standing): ReadonlyArray<Kind> =>
  KINDS.filter(
    (kind) =>
      standing.streaks[kind] >= OFFER_AFTER &&
      !standing.granted.includes(kind) &&
      !standing.declined.includes(kind),
  );

export const grant = (standing: Standing, kind: Kind, now: number): Standing =>
  standing.granted.includes(kind)
    ? standing
    : {
        ...standing,
        granted: adding(standing.granted, kind),
        grantedAt: { ...standing.grantedAt, [kind]: now },
        declined: without(standing.declined, kind),
      };

/** Switched off, or "Not now": Aski stops, and doesn't offer the kind again. */
export const decline = (standing: Standing, kind: Kind): Standing => ({
  ...standing,
  granted: without(standing.granted, kind),
  grantedAt: Object.fromEntries(
    Object.entries(standing.grantedAt ?? {}).filter(([granted]) => granted !== kind),
  ),
  declined: adding(standing.declined, kind),
  streaks: { ...standing.streaks, [kind]: 0 },
});

export const keep = (standing: Standing, key: string): Standing =>
  standing.kept.includes(key)
    ? standing
    : { ...standing, kept: [...standing.kept, key].slice(-KEPT_MAX) };
