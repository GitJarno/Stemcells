/**
 * Upstream's undo notice, for the column and the rail: a settle, snooze, unpin, archive,
 * discarded draft or (ours) answer stays undoable until five seconds after the newest act, and
 * ⌘Z takes back the newest. `undoNotice.contract.test.ts` pins what this relies on.
 */
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";

import { toastManager } from "../../components/ui/toast";
import {
  showThreadUndoNotice,
  undoLatestThreadAction,
  useThreadUndoNotice,
} from "../../hooks/showThreadUndoNotice";
import * as ThreadUndo from "@t3tools/client-runtime/state/thread-undo";
import { shortcutLabelForCommand } from "../../keybindings";
import { primaryServerKeybindingsAtom } from "../../state/server";

export { undoLatestThreadAction };

/** What can be undone now: what was done, and to how many. */
export interface UndoNotice {
  readonly action: "Settled" | "Snoozed" | "Unpinned" | "Archived" | "Discarded" | "Answered";
  readonly count: number;
}

/**
 * An answer on the line: the line's Undo or ⌘Z calls `undo`, and once the
 * line lets it go, `send`. A newer answer to the same need lets the older go.
 */
export function putAnswerOnUndoLine(
  key: string,
  acts: { readonly undo: () => void; readonly send: () => void },
) {
  showThreadUndoNotice({
    action: "Answered",
    claim: ThreadUndo.begin("stemcells-answer", key),
    undo: async () => {
      acts.undo();
      return AsyncResult.success(undefined);
    },
    commit: acts.send,
    failureTitle: "Couldn't take the answer back",
  });
}

export function useUndoNotice(): UndoNotice | null {
  return useThreadUndoNotice((state) => state.notice);
}

/** The keys that undo it (⌘Z), as the person set them, or none. */
export function useUndoKeys(): string | null {
  return shortcutLabelForCommand(useAtomValue(primaryServerKeybindingsAtom), "thread.undo");
}

const UNDO_TOAST_ID = "stemcells-undo-notice";

/**
 * The notice as a toast, where every notice shows (top right). Added again
 * under its id, it changes in place. It has no timeout of its own: upstream's
 * notice times itself out, and `closeUndoToast` follows it.
 */
export function showUndoToast(title: string, undoLabel: string): void {
  toastManager.add({
    id: UNDO_TOAST_ID,
    title,
    timeout: 0,
    actionProps: { children: undoLabel, onClick: undoLatestThreadAction },
  });
}

export function closeUndoToast(): void {
  toastManager.close(UNDO_TOAST_ID);
}
