/**
 * How urgently the disk wants attention, from the bytes left free: calm
 * while there is room, soon while there is still room to act, now when it
 * is time. Absolute gigabytes, not a share, because what fills a developer's
 * disk (builds, simulators, caches) comes in absolute sizes too.
 */
export type DiskPressure = "calm" | "soon" | "now";

/** Below these, free space wants attention: soon, then now. */
export const SOON_BELOW = 20_000_000_000;
export const NOW_BELOW = 10_000_000_000;

export function diskPressure(free: number): DiskPressure {
  return free < NOW_BELOW ? "now" : free < SOON_BELOW ? "soon" : "calm";
}

/** The sidebar foot's figure in the theme's green, yellow or red. */
export const FOOT_TONE: Readonly<Record<DiskPressure, string>> = {
  calm: "text-success-foreground",
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
