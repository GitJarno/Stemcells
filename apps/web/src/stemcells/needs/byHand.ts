/**
 * The Cells the person just moved by their own hand: an answer from an ask, or a settle. Only
 * these hop along the column's line; what the server moves only changes the counts
 * (stemcells/tasks/left-column-v3.md, decision 6).
 */

/** Long enough for an answer's undo line and its Cell's turn to start, or a stop and settle. */
const BY_HAND_MS = 60_000;

const moved = new Map<string, number>();

export function movedByHand(threadId: string, now = Date.now()): void {
  for (const [each, at] of moved) if (now - at >= BY_HAND_MS) moved.delete(each);
  moved.set(threadId, now);
}

/** Whether the person just moved it, once: the move it hops for is theirs, and the next isn't. */
export function takeMovedByHand(threadId: string, now = Date.now()): boolean {
  const at = moved.get(threadId);
  moved.delete(threadId);
  return at !== undefined && now - at < BY_HAND_MS;
}
