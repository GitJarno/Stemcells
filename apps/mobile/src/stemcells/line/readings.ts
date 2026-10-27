// Each machine's reading, fresh without a stream (stemcells/tasks/phone-line.md, decision 3):
// on coming to the front, each minute (a stuck Cell asks by the clock), and when one of its
// chats changes in T3's live data. A streaming Cell changes many times a second, so a machine
// is read at most once a gap, a beat after the change its server derives from too.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { isRelayManagedConnection, useSavedRemoteConnections } from "../upstream/push";
import { readNeeds, type NeedsConnection, type Reading } from "./read";

/** After a chat changes: its machine derives the asks from the same change. */
const BEAT_MS = 400;
/** The least time between two reads of one machine. */
const GAP_MS = 1_500;

let readings: ReadonlyMap<string, Reading> = new Map();
const connections = new Map<string, NeedsConnection>();
const reading = new Map<string, Promise<Reading>>();
const waiting = new Map<string, ReturnType<typeof setTimeout>>();
const lastRead = new Map<string, number>();
const listeners = new Set<() => void>();

function publish(environmentId: string, next: Reading | null) {
  const map = new Map(readings);
  if (next === null) map.delete(environmentId);
  else map.set(environmentId, next);
  readings = map;
  for (const listener of listeners) listener();
}

/** Reads `environmentId` now, or joins the read under way; its reading, once in. */
export function readMachine(environmentId: string): Promise<Reading | null> {
  const under = reading.get(environmentId);
  if (under !== undefined) return under;
  const connection = connections.get(environmentId);
  if (connection === undefined) return Promise.resolve(null);
  const before = readings.get(environmentId);
  const last = before === undefined || before.state === "none" ? null : before.list;
  const read = readNeeds(connection, last).then((next) => {
    reading.delete(environmentId);
    lastRead.set(environmentId, Date.now());
    // Forgotten meanwhile (the connection removed): nothing to show it for.
    if (connections.has(environmentId)) publish(environmentId, next);
    return next;
  });
  reading.set(environmentId, read);
  return read;
}

/** Reads `environmentId` a beat from now, or once the gap since its last read has passed. */
function readSoon(environmentId: string) {
  if (waiting.has(environmentId)) return;
  const since = Date.now() - (lastRead.get(environmentId) ?? 0);
  const timer = setTimeout(
    () => {
      waiting.delete(environmentId);
      // A change during a read is read once that read is in.
      if (reading.has(environmentId))
        void reading.get(environmentId)?.then(() => readSoon(environmentId));
      else void readMachine(environmentId);
    },
    Math.max(BEAT_MS, GAP_MS - since),
  );
  waiting.set(environmentId, timer);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function useReadings(): ReadonlyMap<string, Reading> {
  return useSyncExternalStore(subscribe, () => readings);
}

/**
 * Keeps every saved machine's reading fresh while the home is in front: `chats` are the
 * machines' chats as T3 holds them, `minute` the home's clock.
 */
export function useKeepReading(
  chats: ReadonlyArray<{ readonly environmentId: string }>,
  minute: string,
  inFront: boolean,
): void {
  const { savedConnectionsById } = useSavedRemoteConnections();
  const seen = useRef(new Map<string, ReadonlyArray<unknown>>());

  // oxlint-disable-next-line t3code/react-effect-budget -- Follow the saved connections into the reader, forgetting removed machines and reading new ones.
  useEffect(() => {
    const saved = Object.values(savedConnectionsById);
    for (const id of connections.keys())
      if (!saved.some((connection) => connection.environmentId === id)) {
        connections.delete(id);
        publish(id, null);
      }
    for (const connection of saved) {
      const known = connections.has(connection.environmentId);
      connections.set(connection.environmentId, {
        httpBaseUrl: connection.httpBaseUrl,
        bearerToken: connection.bearerToken,
        ...(isRelayManagedConnection(connection) ? { relayManaged: true as const } : {}),
      });
      if (!known && inFront) void readMachine(connection.environmentId);
    }
  }, [savedConnectionsById, inFront]);

  // Each minute while in front; none behind a chat.
  const tick = inFront ? minute : null;
  // oxlint-disable-next-line t3code/react-effect-budget -- Read every machine on coming to the front, each minute, and on the app's return; remove the AppState listener on change.
  useEffect(() => {
    if (tick === null) return;
    for (const id of connections.keys()) void readMachine(id);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") for (const id of connections.keys()) void readMachine(id);
    });
    return () => subscription.remove();
  }, [tick]);

  // oxlint-disable-next-line t3code/react-effect-budget -- Read a machine again once one of its chats changed in T3's live data.
  useEffect(() => {
    const byMachine = new Map<string, unknown[]>();
    for (const chat of chats) {
      const list = byMachine.get(chat.environmentId) ?? [];
      list.push(chat);
      byMachine.set(chat.environmentId, list);
    }
    for (const [id, list] of byMachine) {
      const before = seen.current.get(id);
      const changed =
        before === undefined ||
        before.length !== list.length ||
        list.some((chat, index) => chat !== before[index]);
      seen.current.set(id, list);
      // The first sight is the front's own read.
      if (changed && before !== undefined && inFront) readSoon(id);
    }
  }, [chats, inFront]);
}
