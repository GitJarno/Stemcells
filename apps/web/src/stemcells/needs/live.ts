/**
 * The page's one list view and one set of holds, wired to the server's
 * stream, upstream's commands and undo line, and the timing tokens. A closing
 * window sends what is still held: the person chose it, and the line was only
 * there to take it back.
 */
import { sendThreadCommand, unsnoozeCell } from "../upstream/needs";
import { useSettleCell } from "../upstream/settle";
import { putAnswerOnUndoLine, takeOffUndoLine } from "../upstream/undoNotice";
import { timing } from "../tokens/motion";
import { movedByHand } from "./byHand";
import { answered, createHolds, useHolds } from "./holds";
import { createPulling, laterOf, usePulling } from "./later";
import { createLeaving } from "./leaving";
import { createPage } from "./page";
import { readNeeds, subscribeNeeds, useNeeds } from "./stream";
import { tellAsk } from "./told";
import type { LaterNeed } from "./wire";

export const holds = createHolds({
  send: sendThreadCommand,
  needs: readNeeds,
  keepLive: () => subscribeNeeds(() => {}),
  line: putAnswerOnUndoLine,
  sent: (key) => void tellAsk(key, "answered"),
});

export const leaving = createLeaving({ needs: readNeeds, subscribeNeeds });

const pulling = createPulling({ needs: readNeeds, subscribeNeeds, unsnooze: unsnoozeCell });

/**
 * The list the page shows: the server's, less what the person answered or is settling, and
 * with what they pulled back from Later. Theirs leaves the page as the server's gone ones do,
 * folding away at once (unblocking.md, 7).
 */
function needsLeft() {
  const state = readNeeds();
  if (state.needs === null) return state;
  const answers = holds.read();
  const settling = leaving.read();
  const left = state.needs.filter(
    (need) => !answered(answers.get(need.key)) && !settling.has(need.threadId),
  );
  const back = [...pulling.read().values()].filter(
    (need) => !state.needs?.some((each) => each.key === need.key),
  );
  return left.length === state.needs.length && back.length === 0
    ? state
    : { ...state, needs: [...left, ...back] };
}

export const page = createPage({
  needs: needsLeft,
  subscribeNeeds: (listener) => {
    const unsubscribes = [
      subscribeNeeds(listener),
      holds.subscribe(listener),
      leaving.subscribe(listener),
      pulling.subscribe(listener),
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

/** What the person put off, soonest back first (`later.ts`). */
export function useLater(): ReadonlyArray<LaterNeed> {
  return laterOf(useNeeds(), useHolds(holds), usePulling(pulling));
}

/**
 * Brings a put-off ask back now: a Later still on the undo line is taken back, and one sent
 * is undone with upstream's unsnooze.
 */
export function pullBack(need: LaterNeed): void {
  if (holds.undo(need.key)) return takeOffUndoLine(need.key);
  holds.forget(need.key);
  void pulling.pull(need);
}
