import { expect, it } from "vite-plus/test";

import type { Collection } from "./kit";
import { momentKey, nextMoment } from "./moments";

const holding = (earned: readonly string[], seen: readonly string[] = []): Collection => ({
  feats: ["landings-1", "landings-10", "landings-100"].map((id) => ({
    id,
    have: 1,
    of: 1,
    earned: earned.includes(id) ? { at: "2026-10-23T10:00:00.000Z", threadId: "pip" } : null,
  })),
  today: { day: "2026-10-23", landings: 0, merges: 0, cells: 0, aloneMs: 0, landed: [] },
  worn: {},
  seen,
  backfilled: true,
});

it("shows a feat earned since a machine's first read, once, and none while its Cell waits", () => {
  const none = new Set<string>();
  const first = new Map([["mac", holding(["landings-1"])]]);
  // The first read's feats are no news, with no baseline yet and with it.
  expect(nextMoment(first, new Map(), none, none)).toBeNull();
  const baselines = new Map([["mac", new Set(["landings-1"])]]);
  expect(nextMoment(first, baselines, none, none)).toBeNull();

  // Earned since: the rarest first, one a time, and not again once shown or seen elsewhere.
  const later = new Map([["mac", holding(["landings-1", "landings-10", "landings-100"])]]);
  const rare = { environmentId: "mac", featId: "landings-100" };
  expect(nextMoment(later, baselines, none, none)).toEqual(rare);
  expect(nextMoment(later, baselines, none, new Set([momentKey(rare)]))).toEqual({
    environmentId: "mac",
    featId: "landings-10",
  });
  const seen = new Map([["mac", holding(["landings-1", "landings-10"], ["landings-10"])]]);
  expect(nextMoment(seen, baselines, none, none)).toBeNull();

  // A machine with a Cell that waits keeps its card back; another machine's still shows.
  const both = new Map([...later, ["mini", holding(["landings-1"])]]);
  const all = new Map([...baselines, ["mini", new Set<string>()]]);
  expect(nextMoment(both, all, new Set(["mac"]), none)).toEqual({
    environmentId: "mini",
    featId: "landings-1",
  });
  expect(nextMoment(both, all, new Set(["mac", "mini"]), none)).toBeNull();
});
