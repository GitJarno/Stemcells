import { useEffect } from "react";

import {
  closeUndoToast,
  showUndoToast,
  type UndoNotice,
  useUndoKeys,
  useUndoNotice,
} from "../upstream/undoNotice";

/** Upstream's notice in our words: "Settled 1 Cell", "Discarded 2 drafts". */
export function undoNoticeWords(notice: UndoNotice): string {
  const noun = notice.action === "Discarded" ? "draft" : "Cell";
  return `${notice.action} ${notice.count} ${noun}${notice.count === 1 ? "" : "s"}`;
}

/**
 * Upstream's undo notice, while the rail shows (`shown`). Upstream draws it
 * only in the wide sidebar, yet ⌘Z from the composer undoes it whenever its
 * sidebar is open, as it is under the rail: without this, ⌘Z after a settle
 * would undo it unseen. So the notice shows as a toast, and goes with it.
 */
export function useRailUndoNotice(shown: boolean): void {
  const notice = useUndoNotice();
  const keys = useUndoKeys();
  useEffect(() => {
    if (shown && notice) showUndoToast(undoNoticeWords(notice), keys ? `${keys} to undo` : "Undo");
    else closeUndoToast();
  }, [shown, notice, keys]);
  useEffect(() => closeUndoToast, []);
}
