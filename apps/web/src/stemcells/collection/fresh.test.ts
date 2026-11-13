import { expect, it } from "vite-plus/test";

import type { Collection, FeatState } from "../../../../../stemcells/ledger/feats.ts";
import { earnedIds, freshFeats, momentOf, rungAbove, standings } from "./fresh.ts";

const state = (id: string, earned: boolean): FeatState => ({
  id,
  have: earned ? 1 : 0,
  of: 1,
  earned: earned ? { at: "2026-10-23T09:00:00.000Z", threadId: "pip" } : null,
});

const collection = (earned: readonly string[], seen: readonly string[] = []): Collection => ({
  feats: ["landings-1", "landings-10", "merges-1", "cells-1000", "alone-120", "dazed-1"].map((id) =>
    state(id, earned.includes(id)),
  ),
  today: { day: "2026-10-23", landings: 0, merges: 0, cells: 0, aloneMs: 0, landed: [] },
  worn: {},
  seen,
  backfilled: true,
});

it("gives a moment to what was earned since the window's first read, the rarest first", () => {
  const baseline = earnedIds(collection(["landings-1"]));
  const now = collection(["landings-1", "merges-1", "cells-1000", "alone-120", "dazed-1"]);
  expect(freshFeats(baseline, now).map(({ feat }) => feat.id)).toEqual([
    "alone-120",
    "dazed-1",
    "cells-1000",
    "merges-1",
  ]);
});

it("gives none to a feat already shown, on this screen or another", () => {
  const now = collection(["merges-1", "cells-1000"], ["cells-1000"]);
  expect(freshFeats(new Set(), now).map(({ feat }) => feat.id)).toEqual(["merges-1"]);
});

it("keeps a feat's card up once it is noted seen, and moves on only when it is dismissed", () => {
  const shownAndSeen = collection(["merges-1", "cells-1000"], ["cells-1000"]);
  expect(momentOf("cells-1000", new Set(), shownAndSeen, new Set())?.feat.id).toBe("cells-1000");
  expect(momentOf(null, new Set(), shownAndSeen, new Set(["cells-1000"]))?.feat.id).toBe(
    "merges-1",
  );
  expect(momentOf(null, new Set(), shownAndSeen, new Set(["merges-1"]))).toBeUndefined();
});

it("names the rung above an earned one, and none above a ladder's top or a secret", () => {
  const now = collection(["landings-1", "alone-120", "dazed-1"]);
  const of = (id: string) => standings(now).find(({ feat }) => feat.id === id)!;
  expect(rungAbove(of("landings-1"), now)?.feat.id).toBe("landings-10");
  expect(rungAbove(of("alone-120"), now)).toBeNull();
  expect(rungAbove(of("dazed-1"), now)).toBeNull();
});
