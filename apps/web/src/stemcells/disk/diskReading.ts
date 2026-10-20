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
      readonly grade: "Safe" | "Careful";
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
        try {
          const response = await getFromPrimary(
            DISK_PATH,
            again ? { measure: "again" } : undefined,
          );
          if (!response.ok) throw new Error(`Disk reading failed: ${response.status}`);
          const next = (await response.json()) as DiskReading;
          scanning = next.scanning;
          if (!stopped) {
            setReading(next);
            setFailed(false);
          }
        } catch {
          if (!stopped) setFailed(true);
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

/** The cleanup Cell's first message: the ask, and the last measurement for it to start from. */
export async function readCleanupDraft(): Promise<string> {
  const response = await getFromPrimary(`${DISK_PATH}/cleanup-draft`);
  if (!response.ok) throw new Error(`Cleanup draft failed: ${response.status}`);
  const body = (await response.json()) as { readonly draft: string };
  return body.draft;
}
