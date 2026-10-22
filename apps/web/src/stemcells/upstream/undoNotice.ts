/**
 * Upstream's undo notice, for the rail. After a settle, a snooze, an unpin,
 * an archive or a discarded draft, upstream keeps the action undoable for
 * five seconds and says so in the wide sidebar's foot. `undoNotice.contract.test.ts`
 * pins what this relies on.
 */
import { useAtomValue } from "@effect/atom-react";

import { toastManager } from "../../components/ui/toast";
import { undoLatestThreadAction, useThreadUndoNotice } from "../../hooks/showThreadUndoNotice";
import { shortcutLabelForCommand } from "../../keybindings";
import { primaryServerKeybindingsAtom } from "../../state/server";

/** What can be undone now: what was done, and to how many. */
export interface UndoNotice {
  readonly action: "Settled" | "Snoozed" | "Unpinned" | "Archived" | "Discarded";
  readonly count: number;
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
