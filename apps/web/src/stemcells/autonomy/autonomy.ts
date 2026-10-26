/**
 * What Aski takes for the person (stemcells/tasks/aski-autonomy.md): the kinds granted, the
 * one it could offer, and the cards it is about to take, from the server's autonomy. One
 * connection, shared by the room, its cards and the switches; the server sends the whole view
 * on connect and on every change.
 */
import { useSyncExternalStore } from "react";

import { readJsonEvents } from "../needs/stream";
import { postToPrimary } from "../upstream/limitResume";
import { openPrimaryStream } from "../upstream/needs";

const PATH = "/api/stemcells/autonomy";
const RETRY_FIRST_MS = 1_000;
const RETRY_MAX_MS = 30_000;

export type Kind = "retry" | "goAhead" | "implement";

// The wire, as the server's `autonomy/Autonomy.ts` sends it.
export interface AutonomyView {
  readonly granted: ReadonlyArray<Kind>;
  readonly declined: ReadonlyArray<Kind>;
  readonly offers: ReadonlyArray<Kind>;
  readonly taking: ReadonlyArray<{
    readonly key: string;
    readonly kind: Kind;
    readonly threadId: string;
    /** When its window began, and when the card goes unless kept. */
    readonly from: string;
    readonly at: string;
  }>;
  readonly took: ReadonlyArray<string>;
}

/** Each kind in the person's words: its switch, its offer, and its take as it goes and once it went. */
export const KINDS: Readonly<
  Record<
    Kind,
    {
      readonly title: string;
      readonly offer: string;
      readonly ask: string;
      readonly taking: string;
      readonly took: string;
    }
  >
> = {
  retry: {
    title: "Retry a lost connection for you",
    offer: "You retried the last 5 times a Cell lost its connection or its provider failed.",
    ask: "Retry for you from now on?",
    taking: "Aski retries it for you",
    took: "Aski retried it for you.",
  },
  goAhead: {
    title: "Go ahead when a Cell stops short",
    offer: "You said go ahead the last 5 times a Cell stopped short of done.",
    ask: "Go ahead for you from now on?",
    taking: "Aski goes ahead for you",
    took: "Aski went ahead for you.",
  },
  implement: {
    title: "Build a ready plan for you",
    offer: "You built the last 5 plans as they were.",
    ask: "Build plans for you from now on?",
    taking: "Aski builds it for you",
    took: "Aski sent it to build for you.",
  },
};

let view: AutonomyView | null = null;
const listeners = new Set<() => void>();
let stop: AbortController | null = null;

function publish(next: AutonomyView | null) {
  view = next;
  for (const listener of listeners) listener();
}

const isView = (data: unknown): data is AutonomyView =>
  typeof data === "object" &&
  data !== null &&
  Array.isArray((data as AutonomyView).granted) &&
  Array.isArray((data as AutonomyView).taking);

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

async function follow(signal: AbortSignal) {
  let retry = RETRY_FIRST_MS;
  while (!signal.aborted) {
    try {
      const response = await openPrimaryStream(`${PATH}/stream`, signal);
      if (!response.ok || response.body === null) throw new Error(`autonomy: ${response.status}`);
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const { values, rest } = readJsonEvents(buffer + value, isView);
        buffer = rest;
        const newest = values.at(-1);
        if (newest !== undefined) {
          publish(newest);
          retry = RETRY_FIRST_MS;
        }
      }
    } catch {
      // Dropped, refused or not yet reachable: try again below.
    }
    if (signal.aborted) return;
    await pause(retry, signal);
    retry = Math.min(retry * 2, RETRY_MAX_MS);
  }
}

function subscribe(listener: () => void): () => void {
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
  };
}

const read = () => view;

/** Null until the server's first view arrives, or on a server without autonomy. */
export function useAutonomy(): AutonomyView | null {
  return useSyncExternalStore(subscribe, read, read);
}

/** Whether this Mac's server took the change. */
async function change(
  body: { grant: Kind } | { decline: Kind } | { keep: string },
): Promise<boolean> {
  const response = await postToPrimary(PATH, body).catch(() => null);
  if (!response?.ok) return false;
  publish((await response.json()) as AutonomyView);
  return true;
}

/** A click on the offer or a switch: Aski takes `kind` for the person, or stops and doesn't offer it again. */
export const setTaking = (kind: Kind, on: boolean) =>
  change(on ? { grant: kind } : { decline: kind });

/** Undo on a card Aski is about to take, or the person answering it themselves. */
export const keepCard = (key: string) => change({ keep: key });
