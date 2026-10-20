import { useNavigate } from "@tanstack/react-router";

import { diskBytes, useDiskFree } from "../disk/diskReading";
import { diskPressure, FOOT_TONE, freeFigure } from "../disk/pressure";
import { cn } from "../upstream/ui";
import { RailTip } from "./RailParts";

/** A 270° arc, open at the bottom, in a 28-unit box. */
const RADIUS = 11;
const ARC = 2 * Math.PI * RADIUS * 0.75;

/** The figure inside the gauge: the gigabytes left, without the unit. */
export function gaugeFigure(free: number): string {
  return freeFigure(free).replace(/ GB$/, "");
}

/**
 * The disk on the rail: an arc of how full it is, the gigabytes left in it,
 * in the wide foot's green, yellow or red. Same reading as the wide foot's
 * (`DiskFoot`); a click opens Settings › Disk.
 */
export function DiskGauge() {
  const volume = useDiskFree();
  const navigate = useNavigate();
  if (volume === null) return null;

  const full = volume.total > 0 ? Math.min(1, Math.max(0, volume.used / volume.total)) : 0;
  const label = `${freeFigure(volume.free)} left of ${diskBytes(volume.total)}`;
  return (
    <RailTip
      title={`${freeFigure(volume.free)} left`}
      detail={`of ${diskBytes(volume.total)}`}
      trigger={
        <button
          type="button"
          aria-label={`Disk: ${label}`}
          data-stemcells-rail-plate=""
          onClick={() => void navigate({ to: "/settings/disk" })}
        >
          <span data-stemcells-gauge="" className={cn(FOOT_TONE[diskPressure(volume.free)])}>
            <svg viewBox="0 0 28 28" aria-hidden>
              <circle
                cx="14"
                cy="14"
                r={RADIUS}
                data-stemcells-gauge-track=""
                strokeDasharray={`${ARC} ${2 * Math.PI * RADIUS}`}
                transform="rotate(135 14 14)"
              />
              <circle
                cx="14"
                cy="14"
                r={RADIUS}
                data-stemcells-gauge-fill=""
                strokeDasharray={`${ARC * full} ${2 * Math.PI * RADIUS}`}
                transform="rotate(135 14 14)"
              />
            </svg>
            <span data-stemcells-gauge-figure="">{gaugeFigure(volume.free)}</span>
          </span>
        </button>
      }
    />
  );
}
