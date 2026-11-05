// Parses what macOS's own tools print about the drives plugged in: `df` (how full), `diskutil` (what
// it is) and, once the person says so, `du` (what fills it). A drive's volume and folder names shape
// that output, so it is untrusted: no name printed becomes a path a client can ask for, and names
// reach only the person's own clients, never a Cell.

export interface MountedVolume {
  readonly device: string;
  readonly mount: string;
  readonly total: number;
  readonly free: number;
}

const DF_LINE = /^(\/dev\/disk\S+)\s+(\d+)\s+\d+\s+(\d+)\s+\d+%\s+(.+)$/;

/** The lines of `df -Plk` on a physical or synthesized disk; a mount's name may hold spaces. */
export function parseDf(output: string): ReadonlyArray<MountedVolume> {
  const volumes: Array<MountedVolume> = [];
  for (const line of output.split("\n")) {
    const match = DF_LINE.exec(line);
    if (match === null) continue;
    const [, device = "", blocks = "0", available = "0", mount = ""] = match;
    volumes.push({
      device,
      mount,
      total: Number(blocks) * 1024,
      free: Number(available) * 1024,
    });
  }
  return volumes;
}

/**
 * A drive a person plugged in or partitioned sits right under `/Volumes`. Deeper mounts, and
 * dotted ones, are macOS's own (`com.apple.TimeMachine.localsnapshots`, `.timemachine`).
 */
export function isVolumesMount(mount: string): boolean {
  if (!mount.startsWith("/Volumes/")) return false;
  const name = mount.slice("/Volumes/".length);
  return name.length > 0 && !name.includes("/") && !name.startsWith(".");
}

export interface DiskInfo {
  readonly name: string | null;
  readonly uuid: string | null;
  readonly bus: string | null;
  readonly internal: boolean;
  readonly solidState: boolean | null;
  readonly filesystem: string | null;
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const plistString = (plist: string, key: string): string | null => {
  const match = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(plist);
  if (match === null || match[1] === undefined || match[1] === "") return null;
  return match[1].replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity] ?? entity);
};

const plistBool = (plist: string, key: string): boolean | null => {
  const match = new RegExp(`<key>${key}</key>\\s*<(true|false)/>`).exec(plist);
  return match === null ? null : match[1] === "true";
};

const UUID = /^[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}$/;

/** The few keys of `diskutil info -plist <mount>` that say what a volume is. */
export function parseDiskInfo(plist: string): DiskInfo {
  const uuid = plistString(plist, "VolumeUUID");
  return {
    name: plistString(plist, "VolumeName"),
    uuid: uuid !== null && UUID.test(uuid) ? uuid.toUpperCase() : null,
    bus: plistString(plist, "BusProtocol"),
    internal: plistBool(plist, "Internal") ?? false,
    solidState: plistBool(plist, "SolidState"),
    filesystem: plistString(plist, "FilesystemType"),
  };
}

/** A mounted installer or simulator runtime is a file on some other disk, not a drive. */
export const isDiskImage = (info: DiskInfo) => info.bus === "Disk Image";

const FILESYSTEM_NAMES: Readonly<Record<string, string>> = {
  apfs: "APFS",
  hfs: "Mac OS Extended",
  exfat: "ExFAT",
  msdos: "FAT",
  ntfs: "NTFS",
};

/** What a person calls a drive's make-up: "USB · Mac OS Extended". */
export function driveDetail(info: DiskInfo): string | null {
  const filesystem =
    info.filesystem === null ? null : (FILESYSTEM_NAMES[info.filesystem] ?? info.filesystem);
  const parts = [info.internal ? null : info.bus, filesystem].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

// MARK: Folders

export interface DriveFolder {
  readonly name: string;
  readonly bytes: number;
  readonly items: ReadonlyArray<{ readonly name: string; readonly bytes: number }>;
}

export interface DriveFolders {
  readonly folders: ReadonlyArray<DriveFolder>;
  /** Bytes in every folder `du` has answered for so far. */
  readonly counted: number;
  /** `du` has printed anything at all: nothing at all means it couldn't open the drive. */
  readonly read: boolean;
}

/** Past this many folders at a drive's top, the rest count toward its size and go unnamed. */
const MOST_FOLDERS = 5_000;
const ITEMS_KEPT = 12;

const DU_LINE = /^(\d+)\t(.+)$/;

type Tally = { bytes: number; sub: number; items: Array<{ name: string; bytes: number }> };

/**
 * Tallies the lines of `du -x -k -d 2 <mount>`, which answers a folder's children before the
 * folder and the mount itself last. A line that isn't a size and a path inside the mount is passed
 * over. A folder named with a line break can still forge one: that only misdraws the map, which
 * opens nothing and starts nothing.
 */
export function makeDuTally(mount: string) {
  const prefix = `${mount}/`;
  const tops = new Map<string, Tally>();
  let counted = 0;
  let read = false;

  const add = (line: string) => {
    const match = DU_LINE.exec(line);
    if (match === null || match[1] === undefined || match[2] === undefined) return;
    const bytes = Number(match[1]) * 1024;
    const path = match[2];
    if (path === mount) {
      read = true;
      return;
    }
    if (!path.startsWith(prefix)) return;
    read = true;
    const [top = "", item, deeper] = path.slice(prefix.length).split("/");
    // Folders that aren't the person's: `.Spotlight-V100`, `.fseventsd`, `.Trashes`.
    if (deeper !== undefined || top === "" || top.startsWith(".")) return;
    let tally = tops.get(top);
    if (tally === undefined) {
      tally = { bytes: 0, sub: 0, items: [] };
      if (tops.size < MOST_FOLDERS) tops.set(top, tally);
    }
    if (item === undefined) {
      counted += Math.max(0, bytes - tally.sub);
      tally.bytes = bytes;
      return;
    }
    counted += bytes;
    tally.sub += bytes;
    if (item.startsWith(".")) return;
    tally.items.push({ name: item, bytes });
    if (tally.items.length > ITEMS_KEPT * 8) {
      tally.items.sort((a, b) => b.bytes - a.bytes);
      tally.items.length = ITEMS_KEPT;
    }
  };

  const result = (): DriveFolders => ({
    folders: [...tops]
      .map(([name, tally]) => ({
        name,
        bytes: Math.max(tally.bytes, tally.sub),
        items: [...tally.items].sort((a, b) => b.bytes - a.bytes).slice(0, ITEMS_KEPT),
      }))
      .sort((a, b) => b.bytes - a.bytes),
    counted,
    read,
  });

  return { add, result, counted: () => counted };
}
