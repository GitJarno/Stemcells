import * as Schema from "effect/Schema";

import type { FindingKind } from "./rules.ts";

// What may move to another drive, and the record of what did. A folder moves only when every
// tool that uses it follows a link in its place, nothing in it is the person's own work, and
// what uses it can be seen to be idle.

export interface Mover {
  /** The folder, from the home. */
  readonly path: string;
  /** What must be idle while it moves. */
  readonly quiet: "simulators" | "xcode";
}

export const MOVERS: Partial<Readonly<Record<FindingKind, Mover>>> = {
  simulators: { path: "Library/Developer/CoreSimulator/Devices", quiet: "simulators" },
  buildData: { path: "Library/Developer/Xcode/DerivedData", quiet: "xcode" },
};

export type MovableKind = "simulators" | "buildData";
export const isMovable = (kind: string): kind is MovableKind => kind in MOVERS;

export const MoveRecord = Schema.Struct({
  kind: Schema.Literals(["simulators", "buildData"]),
  /** The drive's volume UUID. */
  driveId: Schema.String,
  driveName: Schema.String,
  /** Where the folder lives on the drive, under its mount when it was moved. */
  relative: Schema.String,
  bytes: Schema.Number,
  movedAt: Schema.Number,
});
export type MoveRecord = typeof MoveRecord.Type;

const Kept = Schema.Struct({ version: Schema.Literal(1), moves: Schema.Array(MoveRecord) });
export const decodeMoves = Schema.decodeUnknownEffect(Schema.fromJsonString(Kept));
export const encodeMoves = (moves: ReadonlyArray<MoveRecord>) =>
  `${JSON.stringify({ version: 1, moves }, null, 2)}\n`;

export const movesFile = (stateDir: string) => `${stateDir}/stemcells/disk-moves.json`;

/**
 * Where a folder lives on a drive: under a folder of this Mac's own, named by its startup
 * volume's UUID, so two Macs sharing a drive never meet.
 */
export const driveRelative = (machine: string, path: string) => `Stemcells/${machine}/${path}`;

/** Filesystems that keep what a Mac's folders need: permissions, links, extended attributes. */
export const canHold = (filesystem: string | null) =>
  filesystem !== null && /^(apfs|hfs)/i.test(filesystem);

/** Room to copy `bytes` and stay clear of full. */
export const roomFor = (bytes: number) => Math.ceil(bytes * 1.05) + 1024 ** 3;

/** The names of the booted devices in `xcrun simctl list devices booted -j`. */
export function bootedSimulators(json: string): ReadonlyArray<string> {
  const parsed: unknown = JSON.parse(json);
  const devices =
    typeof parsed === "object" && parsed !== null && "devices" in parsed ? parsed.devices : null;
  if (typeof devices !== "object" || devices === null)
    throw new Error("No devices in simctl's list");
  const names: Array<string> = [];
  for (const list of Object.values(devices)) {
    if (!Array.isArray(list)) continue;
    for (const device of list) {
      if (device?.state === "Booted") names.push(String(device.name ?? device.udid));
    }
  }
  return names;
}

/** Every device's UDID in `xcrun simctl list devices -j`, sorted, so two lists compare. */
export function simulatorIds(json: string): ReadonlyArray<string> {
  const parsed: unknown = JSON.parse(json);
  const devices =
    typeof parsed === "object" && parsed !== null && "devices" in parsed ? parsed.devices : null;
  if (typeof devices !== "object" || devices === null)
    throw new Error("No devices in simctl's list");
  const ids: Array<string> = [];
  for (const list of Object.values(devices)) {
    if (!Array.isArray(list)) continue;
    for (const device of list) if (typeof device?.udid === "string") ids.push(device.udid);
  }
  return ids.sort();
}

/** A folder's file count and apparent bytes, as `find | wc -l` and `du -sAk` print them. */
export interface Tally {
  readonly files: number;
  readonly kilobytes: number;
}

/** A copy is whole when it has every file and the same apparent size, give or take rounding. */
export const sameTally = (a: Tally, b: Tally) =>
  a.files === b.files && Math.abs(a.kilobytes - b.kilobytes) <= Math.max(64, a.files / 64);
