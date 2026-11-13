import { describe, expect, it } from "vite-plus/test";

import { FEATS, type FeatState } from "./feats.ts";
import { laddersOf, nextUp, rankOf, RANKS, reachOf, secretsOf, tallyOf } from "./ladders.ts";

/** Every feat as it stands when each measure has come as far as `have` says (0 for one not named). */
const standing = (have: Readonly<Record<string, number>>): FeatState[] =>
  FEATS.map((feat, order) => {
    const value = have[feat.measure] ?? 0;
    return {
      id: feat.id,
      have: value,
      of: feat.of,
      earned:
        value >= feat.of
          ? {
              at: `2026-10-${String(1 + (order % 28)).padStart(2, "0")}T09:00:00.000Z`,
              threadId: null,
            }
          : null,
    };
  });

describe("the feats as ladders", () => {
  it("climb each measure's feats as one ladder, the lowest rung first, every rung higher than the last", () => {
    const ladders = laddersOf(standing({}));
    for (const { rungs } of ladders)
      for (let n = 1; n < rungs.length; n += 1)
        expect(rungs[n]!.feat.of).toBeGreaterThan(rungs[n - 1]!.feat.of);
    expect(ladders.find((ladder) => ladder.measure === "landings")?.rungs).toHaveLength(6);
    // A feat that stands alone is a ladder of one rung, and a secret is on none.
    expect(ladders.find((ladder) => ladder.measure === "straight")?.rungs).toHaveLength(1);
    expect(ladders.some((ladder) => ladder.measure === "dazed")).toBe(false);
  });

  it("say which rung is being climbed and how near it is", () => {
    const [landings] = laddersOf(standing({ landings: 5_472 }));
    expect(landings).toMatchObject({ earned: 4, have: 5_472 });
    expect(landings!.next?.feat.id).toBe("landings-10000");
    expect(reachOf(landings!)).toBeCloseTo(0.5472);
    const [topped] = laddersOf(standing({ landings: 60_000 }));
    expect(topped).toMatchObject({ earned: 6, next: null, have: 60_000 });
    expect(reachOf(topped!)).toBe(1);
  });

  it("put the nearest rungs next up: none not started, none topped, none time climbs alone", () => {
    const ladders = laddersOf(
      standing({ landings: 5_472, merges: 927, crew: 11, straight: 1, days: 300, cells: 0 }),
    );
    expect(nextUp(ladders).map((ladder) => ladder.measure)).toEqual(["merges", "crew", "landings"]);
    expect(nextUp(ladders, 1).map((ladder) => ladder.measure)).toEqual(["merges"]);
  });

  it("count what is earned by segment, the secrets apart and in no total", () => {
    const visible = FEATS.filter((feat) => feat.segment !== null).length;
    expect(tallyOf(standing({}))).toMatchObject({ all: { earned: 0, of: visible }, secrets: 0 });
    const tally = tallyOf(standing({ landings: 100, alone: 600_000, dazed: 1, night: 1 }));
    expect(tally.all.earned).toBe(4);
    expect(tally.secrets).toBe(2);
    expect(tally.segments.map(({ segment, earned }) => [segment, earned])).toEqual([
      ["flight", 3],
      ["trust", 1],
      ["crew", 0],
    ]);
    expect(tally.segments.reduce((sum, each) => sum + each.of, 0)).toBe(visible);
    expect(secretsOf(standing({})).every(({ feat }) => feat.rarity === "secret")).toBe(true);
  });

  it("give a rank for feats earned, the last reachable short of every feat", () => {
    expect(rankOf(0)).toEqual({ rank: 0, toNext: 3 });
    expect(rankOf(24)).toEqual({ rank: 4, toNext: 5 });
    expect(rankOf(99)).toEqual({ rank: RANKS.length - 1, toNext: null });
    const visible = FEATS.filter((feat) => feat.segment !== null).length;
    expect(RANKS.at(-1)).toBeLessThan(visible);
  });
});
