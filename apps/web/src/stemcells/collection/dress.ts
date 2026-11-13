// Dressing a Cell from the wardrobe the feats unlocked: one thing a slot, the newest on top.
// Pure, and the phone's too: both dressing rooms put a piece on and take it off the same way.

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
