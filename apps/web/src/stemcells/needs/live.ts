/**
 * The page's one list view and one set of holds, wired to the server's
 * stream, upstream's commands and undo line, and the timing tokens. A closing
 * window sends what is still held: the person chose it, and the line was only
 * there to take it back.
 */
import { sendThreadCommand } from "../upstream/needs";
import { useSettleCell } from "../upstream/settle";
import { putAnswerOnUndoLine } from "../upstream/undoNotice";
import { timing } from "../tokens/motion";
import { movedByHand } from "./byHand";
import { answered, createHolds } from "./holds";
import { createLeaving } from "./leaving";
import { createPage } from "./page";
import { readNeeds, subscribeNeeds } from "./stream";
import { tellAsk } from "./told";

export const holds = createHolds({
  send: sendThreadCommand,
  needs: readNeeds,
  keepLive: () => subscribeNeeds(() => {}),
  line: putAnswerOnUndoLine,
  sent: (key) => void tellAsk(key, "answered"),
});

export const leaving = createLeaving({ needs: readNeeds, subscribeNeeds });

/**
 * The list the page shows: the server's, less what the person answered or is settling. Theirs
 * leaves the page as the server's gone ones do, folding away at once (unblocking.md, 7).
 */
function needsLeft() {
  const state = readNeeds();
  if (state.needs === null) return state;
  const answers = holds.read();
  const settling = leaving.read();
  const left = state.needs.filter(
    (need) => !answered(answers.get(need.key)) && !settling.has(need.threadId),
  );
  return left.length === state.needs.length ? state : { ...state, needs: left };
}

export const page = createPage({
  needs: needsLeft,
  subscribeNeeds: (listener) => {
    const unsubscribes = [
      subscribeNeeds(listener),
      holds.subscribe(listener),
      leaving.subscribe(listener),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  },
  now: () => Date.now(),
  linger: () => timing("fold"),
  keep: (key) => holds.read().get(key)?.state === "holding",
  clearedFor: () => timing("bannerStay"),
});

if (typeof window !== "undefined") window.addEventListener("pagehide", () => holds.flush());

/** Settles a Cell, off the column at once while it runs (`leaving.ts`). */
export function useSettleAtOnce(): (cell: {
  readonly environmentId: string;
  readonly threadId: string;
}) => Promise<boolean> {
  const settle = useSettleCell();
  return (cell) => {
    movedByHand(cell.threadId);
    return leaving.leaveWhile(cell.threadId, settle(cell));
  };
}
