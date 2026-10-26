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
import { createHolds } from "./holds";
import { createLeaving } from "./leaving";
import { createPage } from "./page";
import { readNeeds, subscribeNeeds } from "./stream";
import { tellAsk } from "./told";

export const holds = createHolds({
  send: sendThreadCommand,
  needs: readNeeds,
  keepLive: () => subscribeNeeds(() => {}),
  line: putAnswerOnUndoLine,
  sent: (key) => tellAsk(key, "answered"),
});

export const leaving = createLeaving({ needs: readNeeds, subscribeNeeds });

export const page = createPage({
  needs: readNeeds,
  subscribeNeeds,
  now: () => Date.now(),
  linger: () => timing("linger"),
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
