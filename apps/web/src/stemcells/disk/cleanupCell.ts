import { toastManager, type useOpenCellWithDraft } from "../upstream/disk";
import { CLEANUP_ASK } from "../../../../../stemcells/words/disk.ts";

/** Opens the cleanup Cell with its ask, or says it couldn't. */
export async function openCleanupCell(
  openCell: NonNullable<ReturnType<typeof useOpenCellWithDraft>>,
): Promise<void> {
  if (await openCell(CLEANUP_ASK)) return;
  toastManager.add({
    type: "error",
    title: "Couldn't start a Cell",
    description: "Try Free space again in a moment.",
  });
}
