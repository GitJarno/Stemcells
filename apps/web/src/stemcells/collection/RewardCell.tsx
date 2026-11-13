/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (collection.css), outside upstream's Tailwind entry. */
// What a feat unlocks, shown on a Cell held still: the piece worn, or the act's telling frame.
// Not earned yet, it is the shape of what waits and no more.

import { type Feat, wornIdOf } from "../../../../../stemcells/ledger/feats.ts";
import { CellStill } from "../cell/CellStill";
import type { Ground } from "../cell/keyline";
import "./collection.css";

/** A Cell that stands in on a tile: no chat's, so its look is only what the tile gives it. */
export const STAND_IN = "collection";

export function RewardCell(props: {
  readonly feat: Feat;
  readonly earned: boolean;
  readonly points: number;
  readonly ground: Ground;
}) {
  const { feat } = props;
  const wornId = wornIdOf(feat.reward);
  return (
    <span className={props.earned ? "inline-flex" : "feat-locked inline-flex"}>
      <CellStill
        name={STAND_IN}
        look={wornId === undefined ? [] : [wornId]}
        provider={null}
        points={props.points}
        ground={props.ground}
        scene={feat.reward.kind === "act" ? `act/${feat.reward.id}` : undefined}
      />
    </span>
  );
}
