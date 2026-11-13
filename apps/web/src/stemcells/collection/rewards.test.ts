import { expect, it } from "vite-plus/test";

import { FEATS, wornIdOf } from "../../../../../stemcells/ledger/feats.ts";
import { featName, featTakes, rewardName } from "../../../../../stemcells/words/feats.ts";
import { ACTS } from "../cell/kit.ts";
import { wornLook } from "../cell/scene.ts";

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
