import { DISK_FULL } from "../../../../../stemcells/words/disk.ts";
import { useMachineDisk } from "../upstream/disk";
import { diskFailure } from "./kit";

/**
 * A failed Cell's line on its home card: the disk's words while its machine
 * is full, or was when it stopped; else the error T3 shows (`words`).
 */
export function FailureWords(props: {
  /** Stopped by a failure, not a limit: only then can the disk be why. */
  readonly failed: boolean;
  readonly environmentId: string;
  /** The stopped turn, so the line says "was full" once there's room again. */
  readonly runId: string;
  readonly words: string;
}) {
  const disk = useMachineDisk(props.failed ? props.environmentId : null);
  const failure = disk == null ? null : diskFailure(props.runId, disk.free);
  return failure === "full"
    ? DISK_FULL.title
    : failure === "freed"
      ? DISK_FULL.freedTitle
      : props.words;
}
