import { useEffect, useRef } from "react";

import { diskBytes } from "../../../../../stemcells/words/disk.ts";
import {
  type EnvironmentId,
  observeResize,
  useDiskMachines,
  useMachineDisk,
} from "../upstream/disk";
import { fieldBands, fieldLayout, SHELF_MOST_CELLS } from "./field";
import { paintShelfField } from "./fieldPainter";
import { useFieldTheme } from "./DriveHero";
import { type Drive, STARTUP_DRIVE, useDrives } from "./diskReading";
import { diskPressure, SOON_BELOW } from "./pressure";

// Every drive of every machine in one row, each a small field: where there's room, at a glance, and
// the way to look closer. Each machine answers for its own drives, through its own connection.

const TILE_FIELD_HEIGHT = 24;

function TileField(props: {
  readonly total: number;
  readonly free: number;
  readonly warnBelow: number;
}) {
  const { total, free, warnBelow } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const { colors, tones } = useFieldTheme();
  const tone = tones[diskPressure(free, warnBelow)];
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Draws to a canvas, and again when its size or figures change.
  useEffect(() => {
    const element = canvas.current;
    if (element === null) return undefined;
    const paint = () => {
      const width = element.parentElement?.clientWidth ?? 0;
      if (width <= 0) return;
      paintShelfField(
        element,
        fieldLayout(
          {
            total,
            bands: fieldBands({ total, free, scanning: false, counted: 0, buckets: null }),
          },
          { width, height: TILE_FIELD_HEIGHT },
          SHELF_MOST_CELLS,
        ),
        colors,
        tone,
      );
    };
    paint();
    return element.parentElement ? observeResize(element.parentElement, paint) : undefined;
  }, [total, free, colors, tone]);
  return (
    <div className="my-1.5 h-6 overflow-hidden">
      <canvas ref={canvas} aria-hidden className="block w-full" />
    </div>
  );
}

const TILE =
  "min-w-24 flex-1 rounded-xl border px-2.5 py-2 text-left outline-none transition-colors focus-visible:border-ring";

/**
 * A machine's drives. Null while it has none to show; a server with no drives route still answers
 * for its home's disk (its host resources). Alone in the row, a single drive shows no tile at all.
 */
function MachineDrives(props: {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly connected: boolean;
  readonly alone: boolean;
  readonly selected: string | null;
  readonly onSelect: (environmentId: EnvironmentId, driveId: string) => void;
}) {
  const { environmentId, connected, selected } = props;
  const known = useDrives(connected ? environmentId : null);
  const snapshot = useMachineDisk(connected && known.status !== "known" ? environmentId : null);
  const drives: ReadonlyArray<Drive> =
    known.status === "known"
      ? known.drives
      : snapshot
        ? [
            {
              id: STARTUP_DRIVE,
              name: props.label,
              role: "startup",
              total: snapshot.total,
              free: snapshot.free,
              detail: null,
              lookInside: true,
              canLookInside: false,
            },
          ]
        : [];
  const warnBelow = known.warnBelow ?? snapshot?.warnBelow ?? SOON_BELOW;
  if (props.alone && drives.length < 2) return null;
  return (
    <div className="min-w-0" style={{ flex: `${Math.max(1, drives.length)} 1 0` }}>
      <h3 className="mb-1.5 ml-px truncate text-2xs font-medium text-muted-foreground">
        {props.label}
      </h3>
      <div className="flex gap-1.5">
        {!connected || drives.length === 0 ? (
          <div className={`${TILE} border-dashed border-border text-xs text-muted-foreground`}>
            {!connected
              ? "Not connected"
              : snapshot === null
                ? "Free space unknown"
                : "Reading the disk…"}
          </div>
        ) : (
          drives.map((drive) => {
            const on = selected === drive.id;
            return (
              <button
                key={drive.id}
                type="button"
                aria-pressed={on}
                aria-label={`${drive.name}, ${diskBytes(drive.free)} free of ${diskBytes(drive.total)}`}
                onClick={() => props.onSelect(environmentId, drive.id)}
                className={`${TILE} ${on ? "border-foreground/20 bg-card" : "border-border hover:bg-accent/60"}`}
              >
                <span
                  className={`block truncate text-xs font-medium ${on ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {drive.name}
                </span>
                <TileField total={drive.total} free={drive.free} warnBelow={warnBelow} />
                <span className="block truncate text-2xs text-muted-foreground tabular-nums">
                  <span className="font-medium text-foreground">{diskBytes(drive.free)}</span> free
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function DriveShelf(props: {
  readonly environmentId: EnvironmentId | null;
  readonly driveId: string;
  readonly onSelect: (environmentId: EnvironmentId, driveId: string) => void;
}) {
  const machines = useDiskMachines();
  return (
    <div className="flex flex-wrap gap-3.5 empty:hidden">
      {machines.map((machine) => (
        <MachineDrives
          key={machine.environmentId}
          environmentId={machine.environmentId}
          label={machine.label}
          connected={machine.connected}
          alone={machines.length === 1}
          selected={machine.environmentId === props.environmentId ? props.driveId : null}
          onSelect={props.onSelect}
        />
      ))}
    </div>
  );
}
