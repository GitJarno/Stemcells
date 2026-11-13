import { expect, it } from "vite-plus/test";

import { FEATS, wornIdOf } from "../../../../../stemcells/ledger/feats.ts";
import { featName, featTakes, rewardName } from "../../../../../stemcells/words/feats.ts";
import { ACTS } from "../cell/kit.ts";
import { wornLook } from "../cell/scene.ts";
import { actsToShow } from "./dress.ts";

it("draws every feat's reward: a piece that fills a slot, or an act the kit can play", () => {
  const undrawn = FEATS.filter(({ reward }) => {
    if (reward.kind === "act") return !ACTS.has(reward.id);
    const worn = Object.values(wornLook([wornIdOf(reward)!]).wardrobe);
    return !worn.some((piece) => piece !== undefined);
  }).map((feat) => `${feat.id}: ${feat.reward.kind} ${feat.reward.id}`);
  expect(undrawn).toEqual([]);
});

it("has words for every feat and its reward", () => {
  const wordless = FEATS.filter(
    (feat) =>
      featName(feat) === feat.id || rewardName(feat) === feat.reward.id || featTakes(feat) === "",
  ).map((feat) => feat.id);
  expect(wordless).toEqual([]);
});

it("offers a feat's act on the stage only once its feat is earned, ahead of the Cell's own", () => {
  const state = (id: string, earned: boolean) => ({
    id,
    have: earned ? 1 : 0,
    of: 1,
    earned: earned ? { at: "2026-10-23T09:00:00.000Z", threadId: null } : null,
  });
  const none = actsToShow(FEATS.map((feat) => state(feat.id, false))).map((act) => act.name);
  expect(none).toContain("hop");
  expect(none).not.toContain("bow");
  const some = actsToShow(FEATS.map((feat) => state(feat.id, feat.id === "landings-10")));
  expect(some[0]?.name).toBe("bow");
  expect(some.map((act) => act.name)).not.toContain("flip");
});
