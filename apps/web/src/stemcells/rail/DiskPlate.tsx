import { useNavigate } from "@tanstack/react-router";
import { HardDriveIcon } from "lucide-react";

import { diskBytes } from "../../../../../stemcells/words/disk.ts";
import { useDiskFree } from "../disk/diskReading";
import { diskPressure, FOOT_TONE, freeFigure } from "../disk/pressure";
import { cn } from "../upstream/ui";
import { RailTip } from "./RailParts";

/**
 * The disk at the foot: a drive and the gigabytes left on it, grey while
 * there's room, amber, then red, as it runs short. Wide, they sit side by
 * side ("19 GB"); on the rail, the figure under the drive. A click opens
 * Settings › Disk, and it is lit while there.
 */
export function DiskPlate(props: { on: boolean; wide?: boolean }) {
  const volume = useDiskFree();
  const navigate = useNavigate();
  if (volume === null) return null;

  const figure = freeFigure(volume.free);
  const label = `${figure} left of ${diskBytes(volume.total)}`;
  return (
    <RailTip
      title={`${figure} left`}
      detail={`of ${diskBytes(volume.total)}`}
      trigger={
        <button
          type="button"
          aria-label={`Disk: ${label}`}
          aria-current={props.on ? "page" : undefined}
          data-stemcells-rail-plate=""
          data-stemcells-disk={props.wide ? "wide" : "rail"}
          data-on={props.on ? "true" : "false"}
          onClick={() => void navigate({ to: "/settings/disk" })}
        >
          <span data-stemcells-disk-body="" className={cn(FOOT_TONE[diskPressure(volume.free)])}>
            <HardDriveIcon aria-hidden />
            <span data-stemcells-disk-figure="">
              {figure.replace(/ GB$/, "")}
              {props.wide ? <span data-stemcells-disk-unit=""> GB</span> : null}
            </span>
          </span>
        </button>
      }
    />
  );
}
