import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { getFromPrimary, type EnvironmentId } from "../upstream/disk";
import { callMachine } from "../upstream/machines";

/** `GET /api/stemcells/disk`, as the server sends it. */
export interface DiskItem {
  readonly path: string;
  readonly name: string;
  readonly bytes: number;
}

export interface DiskReading {
  readonly volume: {
    readonly total: number;
    readonly free: number;
    readonly used: number;
    /** How little free space warns the person, once they chose. */
    readonly warnBelow?: number;
    /** The free space the phone's disk notice was hidden at, while that stands. */
    readonly hiddenAt?: number;
  };
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

export const STARTUP_DRIVE = "startup";

/** `GET /api/stemcells/disk/drives`, one drive. */
export interface Drive {
  readonly id: string;
  readonly name: string;
  readonly role: "startup" | "internal" | "external";
  readonly total: number;
  readonly free: number;
  readonly detail: string | null;
  readonly lookInside: boolean;
  readonly canLookInside: boolean;
}

/** A drive's reading: the startup drive's measurement, or a look inside another (`/drive`). */
export interface DriveReading extends DiskReading {
  readonly drive?: Drive;
  readonly denied?: boolean;
}

export interface MachineDrives {
  /** "unknown": no answer yet, or a server with no drives route, which leaves the snapshot's disk. */
  readonly status: "unknown" | "known";
  readonly drives: ReadonlyArray<Drive>;
  readonly warnBelow?: number;
}

const NO_DRIVES: MachineDrives = { status: "unknown", drives: [] };
const DRIVES_EVERY_MS = 10_000;

/** One reader per machine, however many tiles and pages ask. */
function makeDrivesStore(environmentId: EnvironmentId) {
  let state = NO_DRIVES;
  let lastBody = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  let waiting = 0;
  let latest = 0;
  const listeners = new Set<() => void>();
  const read = async () => {
    if (document.visibilityState !== "visible") return;
    latest += 1;
    const ticket = latest;
    waiting += 1;
    const answer = await callMachine(environmentId, `${DISK_PATH}/drives`);
    waiting -= 1;
    // A failed read keeps the last; a server without the route stays unknown. An older answer
    // never overwrites one asked for since, like the read after opening a drive.
    if (ticket !== latest || !answer.ok || answer.status !== 200) return;
    const text = JSON.stringify(answer.body);
    if (text === lastBody) return;
    lastBody = text;
    const body = answer.body as Omit<MachineDrives, "status">;
    state = {
      status: "known",
      drives: body.drives,
      ...("warnBelow" in body ? { warnBelow: body.warnBelow as number } : {}),
    };
    for (const listener of listeners) listener();
  };
  // A machine slow to answer has one question waiting from each window, not one per tick.
  const poll = () => {
    if (waiting === 0) void read();
  };
  return {
    read,
    state: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        poll();
        timer = setInterval(poll, DRIVES_EVERY_MS);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) clearInterval(timer);
      };
    },
  };
}

const drivesStores = new Map<EnvironmentId, ReturnType<typeof makeDrivesStore>>();

function drivesStoreOf(environmentId: EnvironmentId) {
  const known = drivesStores.get(environmentId);
  if (known !== undefined) return known;
  const store = makeDrivesStore(environmentId);
  drivesStores.set(environmentId, store);
  return store;
}

const noSubscription = () => () => undefined;
const noDrives = () => NO_DRIVES;

/** A machine's drives, read every 10 s while anything shows them and the window is visible. */
export function useDrives(environmentId: EnvironmentId | null): MachineDrives {
  const store = environmentId === null ? null : drivesStoreOf(environmentId);
  return useSyncExternalStore(store?.subscribe ?? noSubscription, store?.state ?? noDrives);
}

const refreshDrives = (environmentId: EnvironmentId) => drivesStoreOf(environmentId).read();

/** Opens or closes a drive to being looked inside; false when the machine didn't take it. */
export async function setLookInside(
  environmentId: EnvironmentId,
  id: string,
  on: boolean,
): Promise<boolean> {
  const answer = await callMachine(environmentId, `${DISK_PATH}/drive/look-inside`, { id, on });
  if (!answer.ok || answer.status !== 200) return false;
  await refreshDrives(environmentId);
  return true;
}

/** Sets a choice about a machine's disk on its own server; false when it didn't take it. */
export async function chooseOnMachine(
  environmentId: EnvironmentId,
  path: "warn" | "notice",
  body: object,
): Promise<boolean> {
  const answer = await callMachine(environmentId, `${DISK_PATH}/${path}`, body);
  return answer.ok && answer.status === 200;
}

async function fetchDriveReading(
  environmentId: EnvironmentId,
  driveId: string,
  again: boolean,
): Promise<DriveReading | null> {
  const measure = again ? { measure: "again" } : {};
  const answer =
    driveId === STARTUP_DRIVE
      ? await callMachine(environmentId, DISK_PATH, null, measure)
      : await callMachine(environmentId, `${DISK_PATH}/drive`, null, { id: driveId, ...measure });
  if (!answer.ok || answer.status !== 200) return null;
  return answer.body as DriveReading;
}

interface HeldReading {
  readonly key: string;
  readonly reading: DriveReading | null;
  readonly failed: boolean;
}

/**
 * A drive, read again every few seconds while the page is visible: free space live, the measurement
 * as soon as its walk ends. Reading a drive keeps its walk alive: the machine stops one nobody asks
 * about. A reading belongs to its drive: switching shows nothing of the last one.
 */
export function useDriveReading(environmentId: EnvironmentId | null, driveId: string) {
  const key = `${environmentId}/${driveId}`;
  const [held, setHeld] = useState<HeldReading | null>(null);
  const readNow = useRef<(again: boolean) => void>(() => undefined);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Poll the drive while visible, faster during a scan, and stop the timer on unmount or a change of drive.
  useEffect(() => {
    if (environmentId === null) return undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest = 0;
    const read = async (again: boolean) => {
      clearTimeout(timer);
      latest += 1;
      const ticket = latest;
      let scanning = false;
      if (document.visibilityState === "visible" || again) {
        const next = await fetchDriveReading(environmentId, driveId, again);
        // A read overtaken by a newer one neither shows nor starts a second chain of reads.
        if (stopped || ticket !== latest) return;
        if (next !== null) scanning = next.scanning;
        setHeld((last) =>
          next === null
            ? { key, reading: last?.key === key ? last.reading : null, failed: true }
            : { key, reading: next, failed: false },
        );
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
  }, [key, environmentId, driveId]);

  const current = held?.key === key ? held : null;
  return {
    reading: current?.reading ?? null,
    failed: current?.failed ?? false,
    measureAgain: () => readNow.current(true),
  };
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

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Poll free space on an interval and on focus or visibility, removing the listeners on unmount.
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
