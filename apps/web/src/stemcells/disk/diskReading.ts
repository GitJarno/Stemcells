import { useEffect, useRef, useState } from "react";

import { getFromPrimary } from "../upstream/disk";

/** `GET /api/stemcells/disk`, as the server sends it. */
export interface DiskItem {
  readonly path: string;
  readonly name: string;
  readonly bytes: number;
}

export interface DiskReading {
  readonly volume: { readonly total: number; readonly free: number; readonly used: number };
  readonly scanning: boolean;
  readonly counted: number;
  readonly map: {
    readonly measuredAt: number;
    readonly partial: boolean;
    readonly measured: number;
    readonly buckets: ReadonlyArray<{
      readonly kind: string;
      readonly title: string;
      readonly bytes: number;
      readonly items: ReadonlyArray<DiskItem>;
    }>;
    readonly findings: ReadonlyArray<{
      readonly kind: string;
      readonly title: string;
      readonly note: string;
      readonly risk: "low" | "medium";
      readonly bytes: number;
      readonly countLabel: string | null;
      readonly paths: ReadonlyArray<DiskItem>;
    }>;
    readonly unreadable: ReadonlyArray<string>;
  } | null;
}

const DISK_PATH = "/api/stemcells/disk";

/** "107 GB", "940 MB", "1.2 TB": decimal units, as Finder and the cleanup report count. */
export function diskBytes(bytes: number): string {
  const value = Math.max(0, bytes);
  const format = (scaled: number, unit: string) => {
    const text = scaled.toFixed(scaled < 10 ? 1 : 0);
    return `${text.endsWith(".0") ? text.slice(0, -2) : text} ${unit}`;
  };
  if (value >= 1e12) return format(value / 1e12, "TB");
  if (value >= 1e9) return format(value / 1e9, "GB");
  if (value >= 1e6) return format(value / 1e6, "MB");
  if (value >= 1e3) return format(value / 1e3, "KB");
  return `${Math.trunc(value)} bytes`;
}

/** One reading of the disk (`again`: measure it anew), or null when the server gave none. */
async function fetchDiskReading(again: boolean): Promise<DiskReading | null> {
  try {
    const response = await getFromPrimary(DISK_PATH, again ? { measure: "again" } : undefined);
    if (!response.ok) return null;
    return (await response.json()) as DiskReading;
  } catch {
    return null;
  }
}

/** Free space alone, or null when the server gave none. */
async function fetchDiskFree(): Promise<DiskReading["volume"] | null> {
  try {
    const response = await getFromPrimary(`${DISK_PATH}/volume`);
    if (!response.ok) return null;
    return (await response.json()) as DiskReading["volume"];
  } catch {
    return null;
  }
}

/**
 * The disk, read again every few seconds while the page is visible: free
 * space live, the measurement as soon as its walk ends.
 */
export function useDiskReading() {
  const [reading, setReading] = useState<DiskReading | null>(null);
  const [failed, setFailed] = useState(false);
  const readNow = useRef<(again: boolean) => void>(() => undefined);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async (again: boolean) => {
      clearTimeout(timer);
      let scanning = false;
      if (document.visibilityState === "visible" || again) {
        const next = await fetchDiskReading(again);
        if (next !== null) scanning = next.scanning;
        if (!stopped) {
          if (next === null) setFailed(true);
          else {
            setReading(next);
            setFailed(false);
          }
        }
      }
      // Faster while a walk runs, so its progress and its end show promptly.
      if (!stopped) timer = setTimeout(() => void read(false), scanning ? 2_000 : 5_000);
    };
    readNow.current = (again) => void read(again);
    void read(false);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return { reading, failed, measureAgain: () => readNow.current(true) };
}

/** How often the sidebar's foot reads free space while the window is visible. */
const FREE_EVERY_MS = 60_000;
/** A window focused this soon after a read keeps it. */
const FREE_FOCUS_AFTER_MS = 10_000;

/**
 * Free space alone (`GET /api/stemcells/disk/volume`, one statfs on the
 * server, never the walk): on mount, every minute while visible, and when
 * the window comes back. Null until the first read lands; a failed read
 * keeps the last.
 */
export function useDiskFree(): DiskReading["volume"] | null {
  const [volume, setVolume] = useState<DiskReading["volume"] | null>(null);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let readAt = 0;
    const read = async () => {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      readAt = performance.now();
      const next = await fetchDiskFree();
      inFlight = false;
      // The last reading stands until a read succeeds.
      if (!stopped && next !== null) setVolume(next);
    };
    const readIfStale = () => {
      if (performance.now() - readAt >= FREE_FOCUS_AFTER_MS) void read();
    };
    void read();
    const timer = setInterval(() => void read(), FREE_EVERY_MS);
    window.addEventListener("focus", readIfStale);
    document.addEventListener("visibilitychange", readIfStale);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", readIfStale);
      document.removeEventListener("visibilitychange", readIfStale);
    };
  }, []);

  return volume;
}

/**
 * The cleanup Cell's first message: the ask, and the last measurement for
 * it to start from; for another machine, which this one didn't measure,
 * the ask alone.
 */
export async function readCleanupDraft(machine: "this" | "other"): Promise<string> {
  const response = await getFromPrimary(
    `${DISK_PATH}/cleanup-draft`,
    machine === "other" ? { machine: "other" } : undefined,
  );
  if (!response.ok) throw new Error(`Cleanup draft failed: ${response.status}`);
  const body = (await response.json()) as { readonly draft: string };
  return body.draft;
}
