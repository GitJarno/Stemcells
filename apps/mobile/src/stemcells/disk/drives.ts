import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { type MachineLine, useMachineLine } from "../upstream/disk";
import { DISK_PATH, type DriveReading, type MachineDrives, STARTUP_DRIVE } from "./kit";

// A machine's drives, and one drive's reading, from that machine's own server, as the Mac's
// Settings › Disk reads them (`apps/web/src/stemcells/disk/diskReading.ts`). Read only while the
// app is in front and something shows them; reading a drive keeps its walk alive on the machine.

const ANSWER_WITHIN_MS = 8_000;

type Answer =
  | { readonly ok: true; readonly status: number; readonly body: unknown }
  | { readonly ok: false };

/** A JSON request to the machine; null `body` for a GET. */
async function callLine(
  line: MachineLine,
  path: string,
  body: object | null = null,
  search: Readonly<Record<string, string>> = {},
): Promise<Answer> {
  // Built by hand: React Native's URL has no working `searchParams`.
  const query = Object.entries(search)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const url = `${new URL(path, line.httpBaseUrl).toString()}${query === "" ? "" : `?${query}`}`;
  const authorization = `Bearer ${line.bearerToken}`;
  // A machine asleep mid-request would hold its reader's next tick until iOS gives up.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ANSWER_WITHIN_MS);
  try {
    const response = await fetch(
      url,
      body === null
        ? { headers: { authorization }, signal: abort.signal }
        : {
            method: "POST",
            headers: { authorization, "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: abort.signal,
          },
    );
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text === "" ? null : JSON.parse(text);
    } catch {
      parsed = null;
    }
    return { ok: true, status: response.status, body: parsed };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

const inFront = () => AppState.currentState === "active";

const NO_DRIVES: MachineDrives = { status: "unknown", drives: [] };
const DRIVES_EVERY_MS = 10_000;

/** One reader per machine and token, however many tiles ask. */
function makeDrivesStore(line: MachineLine) {
  let state = NO_DRIVES;
  let lastBody = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  let back: { remove: () => void } | undefined;
  let waiting = 0;
  let latest = 0;
  const listeners = new Set<() => void>();
  const read = async () => {
    if (!inFront()) return;
    latest += 1;
    const ticket = latest;
    waiting += 1;
    const answer = await callLine(line, `${DISK_PATH}/drives`);
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
      ...(body.warnBelow === undefined ? {} : { warnBelow: body.warnBelow }),
    };
    for (const listener of listeners) listener();
  };
  // A machine slow to answer has one question waiting, not one per tick.
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
        // Back at the front: a reading from before is no glance at the machine now.
        back = AppState.addEventListener("change", poll);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        clearInterval(timer);
        back?.remove();
      };
    },
  };
}

const drivesStores = new Map<
  string,
  { readonly key: string; readonly store: ReturnType<typeof makeDrivesStore> }
>();

function drivesStoreOf(environmentId: string, line: MachineLine) {
  const key = `${line.httpBaseUrl}\n${line.bearerToken}`;
  const known = drivesStores.get(environmentId);
  if (known?.key === key) return known.store;
  const store = makeDrivesStore(line);
  drivesStores.set(environmentId, { key, store });
  return store;
}

const noSubscription = () => () => undefined;
const noDrives = () => NO_DRIVES;

/** A machine's drives, read every 10 s while anything shows them; unknown without a direct line. */
export function useDrives(environmentId: string | null): MachineDrives {
  const line = useMachineLine(environmentId);
  const store = environmentId === null || line === null ? null : drivesStoreOf(environmentId, line);
  return useSyncExternalStore(store?.subscribe ?? noSubscription, store?.state ?? noDrives);
}

/** Opens or closes a drive to being looked inside; false when the machine didn't take it. */
export async function setLookInside(
  environmentId: string,
  line: MachineLine,
  id: string,
  on: boolean,
): Promise<boolean> {
  const answer = await callLine(line, `${DISK_PATH}/drive/look-inside`, { id, on });
  if (!answer.ok || answer.status !== 200) return false;
  await drivesStoreOf(environmentId, line).read();
  return true;
}

interface HeldReading {
  readonly key: string;
  readonly reading: DriveReading | null;
  readonly failed: boolean;
}

/**
 * A drive, read again every few seconds while the app is in front: free space live, the
 * measurement as soon as its walk ends. A reading belongs to its drive: switching shows nothing of
 * the last one.
 */
export function useDriveReading(environmentId: string | null, driveId: string) {
  const line = useMachineLine(environmentId);
  const key = `${environmentId}/${driveId}`;
  const [held, setHeld] = useState<HeldReading | null>(null);
  const readNow = useRef<{ readonly key: string; readonly read: (again: boolean) => void } | null>(
    null,
  );
  const httpBaseUrl = line?.httpBaseUrl ?? null;
  const bearerToken = line?.bearerToken ?? null;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Poll the drive while the app is in front, faster during a walk, and stop on unmount or a change of drive.
  useEffect(() => {
    if (httpBaseUrl === null || bearerToken === null) return undefined;
    const reached = { httpBaseUrl, bearerToken };
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest = 0;
    let lastText = "";
    const read = async (again: boolean) => {
      clearTimeout(timer);
      latest += 1;
      const ticket = latest;
      let scanning = false;
      if (inFront() || again) {
        const measure: Record<string, string> = again ? { measure: "again" } : {};
        const answer =
          driveId === STARTUP_DRIVE
            ? await callLine(reached, DISK_PATH, null, measure)
            : await callLine(reached, `${DISK_PATH}/drive`, null, { id: driveId, ...measure });
        // A read overtaken by a newer one neither shows nor starts a second chain of reads.
        if (stopped || ticket !== latest) return;
        const next = answer.ok && answer.status === 200 ? (answer.body as DriveReading) : null;
        if (next !== null) scanning = next.scanning;
        if (next === null) {
          lastText = "";
          setHeld((last) => ({
            key,
            reading: last?.key === key ? last.reading : null,
            failed: true,
          }));
        } else {
          // The same answer again keeps the reading it was, so the field has nothing to redraw.
          const text = JSON.stringify(next);
          if (text !== lastText) {
            lastText = text;
            setHeld({ key, reading: next, failed: false });
          }
        }
      }
      // Faster while a walk runs, so its progress and its end show promptly.
      if (!stopped) timer = setTimeout(() => void read(false), scanning ? 2_000 : 5_000);
    };
    readNow.current = { key, read: (again) => void read(again) };
    void read(false);
    const back = AppState.addEventListener("change", (state) => {
      if (state === "active") void read(false);
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      back.remove();
      readNow.current = null;
    };
  }, [key, driveId, httpBaseUrl, bearerToken]);

  const current = held?.key === key ? held : null;
  return {
    reading: current?.reading ?? null,
    failed: current?.failed ?? false,
    /** Measures the drive again; given the key it was asked for, only while that drive shows. */
    measureAgain: (forKey: string = key) => {
      if (readNow.current?.key === forKey) readNow.current.read(true);
    },
  };
}
