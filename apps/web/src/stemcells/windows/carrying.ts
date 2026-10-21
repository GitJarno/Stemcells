/**
 * Whether this window has something in the hand: a tab's chip or a chat
 * carried. Moves made by a key (Undo Move, Gather) wait until it is put
 * down, so none changes the windows under a carry still drawn over them.
 */
const carries = new Set<object>();

/** A carry starts; what it returns ends it, and may be called more than once. */
export function carryStarts(): () => void {
  const carry = {};
  carries.add(carry);
  return () => void carries.delete(carry);
}

export function carrying(): boolean {
  return carries.size > 0;
}
