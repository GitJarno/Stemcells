// Dressing a Cell from the wardrobe the feats unlocked: one thing a slot, the newest on top.
// Pure, and the phone's too: both dressing rooms put a piece on and take it off the same way.

import { FEAT_ACTS, type FeatState, unlockedActs } from "../../../../../stemcells/ledger/feats.ts";
import { type Act, ACTS } from "../cell/kit.ts";
import { wornLook } from "../cell/scene.ts";

/** A Cell wears at most this many chosen things: one a slot. */
const MOST_WORN = 4;

/** No more Cells than this are offered to dress: a row of them, not the machine's census. */
export const MOST_TO_DRESS = 12;

/** The slots a worn id fills: two that share one can't be worn together. */
const slotsOf = (id: string): string[] =>
  Object.entries(wornLook([id]).wardrobe).flatMap(([slot, piece]) =>
    piece === undefined ? [] : [slot],
  );

/** `worn` with `id` put on first, in place of whatever held its slots; or taken off, when it was on. */
export function toggled(worn: readonly string[], id: string): string[] {
  if (worn.includes(id)) return worn.filter((each) => each !== id);
  const taken = new Set(slotsOf(id));
  return [id, ...worn.filter((each) => !slotsOf(each).some((slot) => taken.has(slot)))].slice(
    0,
    MOST_WORN,
  );
}

/** The acts a Cell shows on the stage: the ones its feats unlocked first, then its own; none a feat still holds. */
export function actsToShow(feats: ReadonlyArray<FeatState>): Act[] {
  const unlocked = unlockedActs(feats);
  const resting = [...ACTS.values()].filter((act) => act.state === "rest");
  return [
    ...resting.filter((act) => unlocked.has(act.name)),
    ...resting.filter((act) => !FEAT_ACTS.has(act.name)),
  ];
}
