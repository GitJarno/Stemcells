/**
 * One connection to the server's list of what needs the person, shared by
 * every view that shows it: Aski's tab count, Aski's column and the holds.
 * The server sends the whole list on connect and on every change, so a
 * reconnect needs no catching up: the newest list is the truth.
 */
import { useSyncExternalStore } from "react";

import { openPrimaryStream } from "../upstream/needs";
import type { Need, NeedsList } from "./wire";

const STREAM_PATH = "/api/stemcells/needs/stream";
const RETRY_FIRST_MS = 1_000;
const RETRY_MAX_MS = 30_000;

export interface NeedsState {
  /** Null until the server's first list arrives. */
  readonly needs: ReadonlyArray<Need> | null;
  /** Whether the list is live; a list kept from before a drop may be stale. */
  readonly live: boolean;
}

/** Splits what has arrived into whole events: the lists they carry, and the rest. */
export function readEvents(buffer: string): {
  readonly lists: ReadonlyArray<NeedsList>;
  readonly rest: string;
} {
  const lists: NeedsList[] = [];
  const events = buffer.replaceAll("\r\n", "\n").split("\n\n");
  const rest = events.pop() ?? "";
  for (const event of events) {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (data === "") continue;
    try {
      const list = JSON.parse(data) as NeedsList;
      if (Array.isArray(list.needs)) lists.push(list);
    } catch {
      // A torn or foreign event; the next whole list replaces it.
    }
  }
  return { lists, rest };
}

let state: NeedsState = { needs: null, live: false };
const listeners = new Set<() => void>();
let stop: AbortController | null = null;

function publish(next: NeedsState) {
  state = next;
  for (const listener of listeners) listener();
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

async function follow(signal: AbortSignal) {
  let retry = RETRY_FIRST_MS;
  while (!signal.aborted) {
    try {
      const response = await openPrimaryStream(STREAM_PATH, signal);
      if (!response.ok || response.body === null)
        throw new Error(`needs stream: ${response.status}`);
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const { lists, rest } = readEvents(buffer + value);
        buffer = rest;
        const newest = lists.at(-1);
        if (newest !== undefined) {
          publish({ needs: newest.needs, live: true });
          retry = RETRY_FIRST_MS;
        }
      }
    } catch {
      // Dropped, refused or not yet reachable: try again below.
    }
    if (signal.aborted) return;
    if (state.live) publish({ ...state, live: false });
    await pause(retry, signal);
    retry = Math.min(retry * 2, RETRY_MAX_MS);
  }
}

/** Keeps the connection open while anything listens. */
export function subscribeNeeds(listener: () => void): () => void {
  listeners.add(listener);
  if (stop === null) {
    stop = new AbortController();
    void follow(stop.signal);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || stop === null) return;
    stop.abort();
    stop = null;
    state = { ...state, live: false };
  };
}

export const readNeeds = (): NeedsState => state;

export function useNeeds(): NeedsState {
  return useSyncExternalStore(subscribeNeeds, readNeeds, readNeeds);
}
