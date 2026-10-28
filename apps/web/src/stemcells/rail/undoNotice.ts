import { useEffect } from "react";

import {
  closeUndoToast,
  showUndoToast,
  type UndoNotice,
  useUndoKeys,
  useUndoNotice,
} from "../upstream/undoNotice";

/** Upstream's notice in our words: "Settled 1 Cell", "Answered 2 Cells", "Discarded 2 drafts". */
export function undoNoticeWords(notice: UndoNotice): string {
  const noun = notice.action === "Discarded" ? "draft" : "Cell";
  return `${notice.action} ${notice.count} ${noun}${notice.count === 1 ? "" : "s"}`;
}

/**
 * Upstream's undo notice as a toast, while `shown`: where no undo line
 * stands (the rail, or the column hidden), ⌘Z away from a text field
 * still undoes it, and without this would undo it unseen.
 */
export function useRailUndoNotice(shown: boolean): void {
  const notice = useUndoNotice();
  const keys = useUndoKeys();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Show or close the imperative undo toast to match the notice and whether the column shows.
  useEffect(() => {
    if (shown && notice) showUndoToast(undoNoticeWords(notice), keys ? `${keys} to undo` : "Undo");
    else closeUndoToast();
  }, [shown, notice, keys]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Close the undo toast when the column unmounts.
  useEffect(() => closeUndoToast, []);
}
