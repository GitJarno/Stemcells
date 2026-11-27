// Folders a machine rebuilds, kept on another of its drives: the answer of its server's
// `/api/stemcells/disk/moves`, and what Settings › Disk shows for each, on the web and the phone
// alike (`apps/mobile/src/stemcells/disk/kit.ts`). Plain TypeScript, so both draw one model.

import { DISK_MOVE, diskBytes } from "../../../../../stemcells/words/disk.ts";
import type { Drive } from "./wire.ts";

export type MovableKind = "simulators" | "buildData";
export type MovePhase =
  | "measuring"
  | "copying"
  | "checking"
  | "switching"
  | "permission"
  | "finishing";

export interface MovesAnswer {
  readonly places: ReadonlyArray<{
    readonly kind: MovableKind;
    readonly title: string;
    readonly where: "here" | "away" | "none";
    readonly drive?: { readonly id: string; readonly name: string; readonly connected: boolean };
    readonly bytes?: number;
  }>;
  readonly job: {
    readonly kind: MovableKind;
    readonly direction: "away" | "back";
    readonly driveName: string;
    readonly phase: MovePhase;
    readonly done: number;
    readonly total: number;
  } | null;
  readonly last: {
    readonly kind: MovableKind;
    readonly direction: "away" | "back" | "fresh";
    readonly ok: boolean;
    readonly reason: string | null;
    readonly at: number;
  } | null;
}

export const MOVES_PATH = "/api/stemcells/disk/moves";

/** Read this often while a move runs; otherwise as often as the drives. */
export const MOVES_EVERY_MS = { moving: 1_500, idle: 10_000 } as const;

/** Drives with room for `bytes` and 5% more, the server's own test, so an offer never bounces on room. */
function drivesFor(drives: ReadonlyArray<Drive>, bytes: number): ReadonlyArray<Drive> {
  const room = Math.ceil(bytes * 1.05) + 1024 ** 3;
  return drives.filter((drive) => drive.role !== "startup" && drive.free >= room);
}

/** What a finding of this kind offers: the drives it can move to, or none when it can't move now. */
export function moveOffer(
  moves: MovesAnswer | null,
  kind: string,
  bytes: number,
  drives: ReadonlyArray<Drive>,
): ReadonlyArray<Drive> {
  if (moves === null || moves.job !== null) return [];
  const place = moves.places.find((each) => each.kind === kind);
  return place?.where === "here" ? drivesFor(drives, bytes) : [];
}

export interface MoveRow {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly tone: "plain" | "working" | "error";
  /** 0 to 1 while copying. */
  readonly progress: number | null;
  readonly size: number | null;
  readonly actions: ReadonlyArray<{
    readonly id: "back" | "fresh";
    readonly kind: MovableKind;
    readonly label: string;
    readonly confirm?: string;
  }>;
}

const titleOf = (moves: MovesAnswer, kind: MovableKind) =>
  moves.places.find((each) => each.kind === kind)?.title ?? kind;

/** A failure stays on the page this long; a success is a toast, not a row. */
const FAILURE_SHOWS_MS = 60 * 60_000;

/** The rows of "On other drives": a move under way, a recent failure, then each folder kept away. */
export function moveRows(moves: MovesAnswer | null, nowMs: number): ReadonlyArray<MoveRow> {
  if (moves === null) return [];
  const rows: Array<MoveRow> = [];
  const { job, last } = moves;
  if (job !== null) {
    const title = titleOf(moves, job.kind);
    const said =
      job.phase === "copying"
        ? DISK_MOVE.copied(diskBytes(job.done), diskBytes(job.total))
        : DISK_MOVE[job.phase];
    rows.push({
      key: "job",
      title:
        job.direction === "away"
          ? DISK_MOVE.moving(title, job.driveName)
          : DISK_MOVE.movingBack(title, job.driveName),
      description: said,
      tone: "working",
      progress: job.phase === "copying" && job.total > 0 ? Math.min(1, job.done / job.total) : null,
      size: null,
      actions: [],
    });
  }
  if (job === null && last !== null && !last.ok && nowMs - last.at < FAILURE_SHOWS_MS) {
    rows.push({
      key: "failed",
      title: DISK_MOVE.failed(titleOf(moves, last.kind)),
      description: last.reason ?? "",
      tone: "error",
      progress: null,
      size: null,
      actions: [],
    });
  }
  for (const place of moves.places) {
    if (place.where !== "away" || place.drive === undefined) continue;
    if (job?.kind === place.kind) continue;
    const { name, connected } = place.drive;
    rows.push({
      key: place.kind,
      title: `${place.title} · ${DISK_MOVE.on(name)}`,
      description: connected ? DISK_MOVE.onNote : DISK_MOVE.away(name),
      tone: connected ? "plain" : "error",
      progress: null,
      size: place.bytes ?? null,
      actions:
        job !== null
          ? []
          : connected
            ? [{ id: "back", kind: place.kind, label: DISK_MOVE.back }]
            : [
                {
                  id: "fresh",
                  kind: place.kind,
                  label: DISK_MOVE.fresh,
                  confirm: DISK_MOVE.freshConfirm(place.title, name),
                },
              ],
    });
  }
  return rows;
}

/** What to tell the person when a move they watched ends, or null. */
export function moveEnded(
  before: MovesAnswer | null,
  after: MovesAnswer,
): { readonly ok: boolean; readonly title: string; readonly description?: string } | null {
  if (before?.job == null || after.job !== null || after.last === null) return null;
  const { last } = after;
  const title = titleOf(after, last.kind);
  if (!last.ok) {
    return {
      ok: false,
      title: DISK_MOVE.failed(title),
      ...(last.reason === null ? {} : { description: last.reason }),
    };
  }
  return {
    ok: true,
    title:
      last.direction === "back"
        ? DISK_MOVE.movedBack(title)
        : DISK_MOVE.moved(title, before.job.driveName),
  };
}
