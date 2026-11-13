import { expect, it } from "vite-plus/test";

import type { Collection, FeatState } from "../../../../../stemcells/ledger/feats.ts";
import { earnedIds, freshFeats, momentOf } from "./fresh.ts";

const state = (id: string, earned: boolean): FeatState => ({
  id,
  have: earned ? 1 : 0,
  of: 1,
  earned: earned ? { at: "2026-10-23T09:00:00.000Z", threadId: "pip" } : null,
});

const collection = (earned: readonly string[], seen: readonly string[] = []): Collection => ({
  feats: ["landings-1", "merges-1", "cells-100", "alone-120", "dazed-1"].map((id) =>
    state(id, earned.includes(id)),
  ),
  today: { day: "2026-10-23", landings: 0, merges: 0, cells: 0, aloneMs: 0, landed: [] },
  worn: {},
  seen,
  backfilled: true,
});

it("gives a moment to what was earned since the window's first read, the rarest first", () => {
  const baseline = earnedIds(collection(["landings-1"]));
  const now = collection(["landings-1", "merges-1", "cells-100", "alone-120", "dazed-1"]);
  expect(freshFeats(baseline, now).map(({ feat }) => feat.id)).toEqual([
    "alone-120",
    "dazed-1",
    "cells-100",
    "merges-1",
  ]);
});

it("gives none to a feat already shown, on this screen or another", () => {
  const now = collection(["merges-1", "cells-100"], ["cells-100"]);
  expect(freshFeats(new Set(), now).map(({ feat }) => feat.id)).toEqual(["merges-1"]);
});

it("keeps a feat's card up once it is noted seen, and moves on only when it is dismissed", () => {
  const shownAndSeen = collection(["merges-1", "cells-100"], ["cells-100"]);
  expect(momentOf("cells-100", new Set(), shownAndSeen, new Set())?.feat.id).toBe("cells-100");
  expect(momentOf(null, new Set(), shownAndSeen, new Set(["cells-100"]))?.feat.id).toBe("merges-1");
  expect(momentOf(null, new Set(), shownAndSeen, new Set(["merges-1"]))).toBeUndefined();
});
