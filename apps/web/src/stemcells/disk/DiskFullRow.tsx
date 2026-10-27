import { HardDriveIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { DISK_FULL } from "../../../../../stemcells/words/disk.ts";
import { useMachineDisk, useOpenCellWithDraft, type EnvironmentId } from "../upstream/disk";
import {
  Button,
  Spinner,
  TimelineRowTimestamp,
  WorkLogRow,
  type TimestampFormat,
} from "../upstream/transcriptRow";
import { openCleanupCell } from "./cleanupCell";
import { diskFailure } from "./pressure";

// A Cell's failed turn while the disk of the machine it runs on is full: "The disk is full", with
// Free space, which opens the cleanup Cell there. Once there's room again it says so. Any other
// failure, or one before the machine's first reading, is `fallback`: upstream's row.

export function DiskFullRow(props: {
  readonly entryId: string;
  readonly environmentId: EnvironmentId;
  readonly createdAt: string;
  readonly timestampFormat: TimestampFormat;
  readonly fallback: ReactNode;
}) {
  const disk = useMachineDisk(props.environmentId);
  const openCell = useOpenCellWithDraft(props.environmentId);
  const [opening, setOpening] = useState(false);
  const failure = disk == null ? null : diskFailure(props.entryId, disk.free);
  if (failure === null) return props.fallback;

  const full = failure === "full";
  const freeSpace = async () => {
    if (openCell === null) return;
    setOpening(true);
    await openCleanupCell(openCell).finally(() => setOpening(false));
  };
  return (
    <WorkLogRow
      data-v2-item-type="error"
      data-stemcells-disk-full={failure}
      wrapLabel
      icon={
        <HardDriveIcon
          className={full ? "size-4 text-destructive" : "size-4 text-muted-foreground"}
        />
      }
      label={
        <span
          className={
            full ? "text-sm font-medium text-destructive" : "text-sm font-medium text-foreground/90"
          }
        >
          {full ? DISK_FULL.title : DISK_FULL.freedTitle}
        </span>
      }
      trailing={
        <TimelineRowTimestamp
          createdAt={props.createdAt}
          timestampFormat={props.timestampFormat}
          alwaysVisible
        />
      }
    >
      <p className="ms-7 py-1 text-sm leading-relaxed text-foreground/80">
        {full ? DISK_FULL.note : DISK_FULL.freedNote}
      </p>
      {full && openCell !== null ? (
        <div className="ms-7 pb-1">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={opening}
            onClick={() => void freeSpace()}
          >
            {opening ? <Spinner /> : <HardDriveIcon aria-hidden />}
            {DISK_FULL.action}
          </Button>
        </div>
      ) : null}
    </WorkLogRow>
  );
}
