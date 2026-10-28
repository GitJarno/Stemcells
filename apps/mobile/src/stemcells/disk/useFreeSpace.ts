import { CLEANUP_ASK } from "../../../../../stemcells/words/disk.ts";
import { Dialog, useOpenDiskCell } from "../upstream/disk";

/**
 * Free space on a machine: a new Cell in its Disk project, the cleanup ask
 * waiting unsent, over what the person is on (or in Settings' place). Null
 * when that machine can't start one now.
 */
export function useFreeSpace(
  environmentId: string,
  how: "push" | "replace" = "push",
): (() => Promise<void>) | null {
  const openCell = useOpenDiskCell(environmentId, how);
  if (openCell === null) return null;
  return async () => {
    if (!(await openCell(CLEANUP_ASK))) {
      Dialog.alert("Couldn't start a Cell", "Try again in a moment.");
    }
  };
}
