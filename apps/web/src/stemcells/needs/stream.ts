/**
 * One connection to the server's list of what needs the person, shared by
 * every view that shows it: Aski's tab count, Aski's column and the holds.
 * The server sends the whole list on connect and on every change, so a
 * reconnect needs no catching up: the newest list is the truth.
 */
import { useSyncExternalStore } from "react";

import { openPrimaryStream } from "../upstream/needs";
import type { CellStanding, HandSettle, LaterNeed, Need, NeedsList } from "./wire";

const STREAM_PATH = "/api/stemcells/needs/stream";
const RETRY_FIRST_MS = 1_000;
const RETRY_MAX_MS = 30_000;

export interface NeedsState {
  /** Null until the server's first list arrives. */
  readonly needs: ReadonlyArray<Need> | null;
  /** What the person put off; absent until the first list arrives. */
  readonly later?: ReadonlyArray<LaterNeed>;
  /** Every Cell's stage, for the roster; null until the first list arrives. */
  readonly cells: ReadonlyArray<CellStanding> | null;
  /** The day's settles by hand, on any device; absent until the first list arrives. */
  readonly settles?: ReadonlyArray<HandSettle>;
  /** Whether the list is live; a list kept from before a drop may be stale. */
  readonly live: boolean;
}

/**
 * Splits what has arrived of a server's event stream into whole events: the
 * JSON each carries that `accept` takes, and the rest, a torn event waiting
 * for the next chunk.
 */
export function readJsonEvents<T>(
  buffer: string,
  accept: (data: unknown) => data is T,
): { readonly values: ReadonlyArray<T>; readonly rest: string } {
  const values: T[] = [];
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
      const value: unknown = JSON.parse(data);
      if (accept(value)) values.push(value);
    } catch {
      // A torn or foreign event; the next whole one replaces it.
    }
  }
  return { values, rest };
}

const isList = (data: unknown): data is NeedsList =>
  typeof data === "object" && data !== null && Array.isArray((data as NeedsList).needs);

/** Splits what has arrived into whole events: the lists they carry, and the rest. */
export function readEvents(buffer: string): {
  readonly lists: ReadonlyArray<NeedsList>;
  readonly rest: string;
} {
  const { values, rest } = readJsonEvents(buffer, isList);
  return { lists: values, rest };
}

let state: NeedsState = { needs: null, cells: null, live: false };
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

/**
 * Follows a server's event stream until `signal` aborts: the JSON of each whole event `accept`
 * takes goes to `take`, a batch at a time. A drop, a refusal or no answer calls `dropped` and
 * tries again, a second on and doubling to half a minute; `open` answering null means there is
 * nothing there to follow.
 */
export async function followEvents<T>(input: {
  readonly open: (signal: AbortSignal) => Promise<Response | null>;
  readonly accept: (data: unknown) => data is T;
  readonly take: (values: ReadonlyArray<T>) => void;
  readonly dropped: () => void;
  readonly signal: AbortSignal;
}): Promise<void> {
  const { signal } = input;
  let retry = RETRY_FIRST_MS;
  while (!signal.aborted) {
    try {
      const response = await input.open(signal);
      if (response === null) return;
      if (!response.ok || response.body === null) throw new Error(`stream: ${response.status}`);
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const { values, rest } = readJsonEvents(buffer + value, input.accept);
        buffer = rest;
        if (values.length > 0) {
          input.take(values);
          retry = RETRY_FIRST_MS;
        }
      }
    } catch {
      // Dropped, refused or not yet reachable: try again below.
    }
    if (signal.aborted) return;
    input.dropped();
    await pause(retry, signal);
    retry = Math.min(retry * 2, RETRY_MAX_MS);
  }
}

const follow = (signal: AbortSignal) =>
  followEvents({
    open: (signal) => openPrimaryStream(STREAM_PATH, signal),
    accept: isList,
    take: (lists) => {
      const newest = lists.at(-1)!;
      publish({
        needs: newest.needs,
        later: newest.later ?? [],
        cells: newest.cells ?? [],
        settles: newest.settles ?? [],
        live: true,
      });
    },
    dropped: () => {
      if (state.live) publish({ ...state, live: false });
    },
    signal,
  });

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

/**
 * A Cell's stage as the server reads it (stage.ts there), or null: not in
 * reach (settled, a draft, on another machine), or not known yet.
 */
export function useCellStage(threadId: string | null): CellStanding["stage"] | null {
  const { cells } = useNeeds();
  if (threadId === null) return null;
  return cells?.find((cell) => cell.threadId === threadId)?.stage ?? null;
}
