// Which feat gets its moment next on the phone: across the machines it reads, one earned since
// the phone first read that machine (never what that first read already held), not shown before,
// and none from a machine one of whose Cells waits on the person. Pure.

import { type Collection, earnedIds, freshFeats } from "./kit";

export interface Moment {
  readonly environmentId: string;
  readonly featId: string;
}

export const momentKey = (moment: Moment): string => `${moment.environmentId}|${moment.featId}`;

/**
 * The next feat to show, the machines in the order they were read: `baselines` is what each had
 * earned at the phone's first read (a machine without one is being read for the first time),
 * `waiting` the machines with a Cell that waits on the person, `shown` the moments already had.
 */
export function nextMoment(
  collections: ReadonlyMap<string, Collection>,
  baselines: ReadonlyMap<string, ReadonlySet<string>>,
  waiting: ReadonlySet<string>,
  shown: ReadonlySet<string>,
): Moment | null {
  for (const [environmentId, collection] of collections) {
    if (waiting.has(environmentId)) continue;
    const baseline = baselines.get(environmentId) ?? earnedIds(collection);
    const next = freshFeats(baseline, collection).find(
      ({ feat }) => !shown.has(momentKey({ environmentId, featId: feat.id })),
    );
    if (next !== undefined) return { environmentId, featId: next.feat.id };
  }
  return null;
}
