import { FULL_BELOW, SOON_BELOW } from "../../../../../stemcells/disk/notice.ts";

export { FULL_BELOW, noticeShown, SOON_BELOW } from "../../../../../stemcells/disk/notice.ts";

/**
 * How urgently the disk wants attention, from the bytes left free: calm
 * while there is room, soon while there is still room to act, now when it
 * is time. Absolute gigabytes, not a share, because what fills a developer's
 * disk (builds, simulators, caches) comes in absolute sizes too.
 */
export type DiskPressure = "calm" | "soon" | "now";

/** What the person may choose for `warnBelow`, in place of `SOON_BELOW`. */
export const WARN_CHOICES = [5e9, 10e9, 20e9, 50e9] as const;

const seenFull = new Set<string>();

export type DiskFailure = "full" | "freed" | null;

/**
 * Whether a failed turn is the disk's: "full" while its machine has under
 * `FULL_BELOW` free, "freed" once there's room again after it was seen full
 * in this window, else null (the failure was something else, or happened
 * before this window last saw the disk full).
 */
export function diskFailure(entryId: string, free: number): DiskFailure {
  if (free < FULL_BELOW) seenFull.add(entryId);
  const failure = free < FULL_BELOW ? "full" : seenFull.has(entryId) ? "freed" : null;
  lastRead.set(entryId, failure);
  return failure;
}

const lastRead = new Map<string, DiskFailure>();

/**
 * What `diskFailure` last said of `entryId`, null before it was asked: what
 * reads a card outside React (Aski's composer) says what the card shows.
 */
export function lastDiskFailure(entryId: string): DiskFailure {
  return lastRead.get(entryId) ?? null;
}

export function diskPressure(free: number, warnBelow: number = SOON_BELOW): DiskPressure {
  return free < warnBelow / 2 ? "now" : free < warnBelow ? "soon" : "calm";
}

/** The foot's disk: quiet while there's room, then the theme's amber and red. */
export const FOOT_TONE: Readonly<Record<DiskPressure, string>> = {
  calm: "",
  soon: "text-warning-foreground",
  now: "text-error-foreground",
};

/**
 * The figure at the foot: whole gigabytes, a decimal only under one, where
 * "0.9 GB" says 900 MB, and "<0.1 GB" below that. A dot whatever the
 * locale, and no decimals above one, so the figure stays narrow.
 */
export function freeFigure(free: number): string {
  const gb = Math.max(0, free) / 1e9;
  if (gb === 0) return "0 GB";
  if (gb < 0.1) return "<0.1 GB";
  const tenths = Math.round(gb * 10) / 10;
  return `${tenths < 1 ? tenths.toFixed(1) : Math.round(gb).toString()} GB`;
}
