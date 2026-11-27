/**
 * What the sky reads of Input (stemcells/tasks/inbox.md, decisions 6 and 7; day-night.md): the
 * dawn over Input lifts a step with each answer, and the last one's all-clear is the sunrise.
 * One store per app: the Mac's column and the phone's home each publish theirs.
 */
import { useSyncExternalStore } from "react";

import { SKY_AT, skyAtStage } from "../motion/sky";
import { type Loop, progressOf } from "./loop";

export interface InboxSky {
  /** Asks answered of all the clearing met; null outside a clearing. */
  readonly progress: { readonly done: number; readonly of: number } | null;
  /** Input's Cells waiting; null until the queue has been read. */
  readonly waiting: number | null;
  /** How many clearings have ended: a new one is the sunrise. */
  readonly clears: number;
}

let sky: InboxSky = { progress: null, waiting: null, clears: 0 };
const listeners = new Set<() => void>();

/** Hands the sky a step of the loop, in one change; `allClear`, its last ask just answered. */
export function publishInbox(loop: Loop, allClear: boolean): void {
  const progress = progressOf(loop);
  const waiting = loop.view === null ? null : loop.queue.length;
  const same =
    progress?.done === sky.progress?.done &&
    progress?.of === sky.progress?.of &&
    waiting === sky.waiting;
  if (same && !allClear) return;
  sky = { progress, waiting, clears: sky.clears + (allClear ? 1 : 0) };
  for (const listener of listeners) listener();
}

/** How much of dawn's way to day the answers lift it, a step each; the sunrise takes the rest. */
const DAWN_LIFTS = 0.5;

/** The sky over `stage`: Input's dawn lifts with each answer, and is day once nothing waits. */
export function skyOver(stage: string, inbox: InboxSky): number {
  if (stage !== "needs") return skyAtStage(stage);
  if (inbox.waiting === 0) return SKY_AT.day;
  const progress = inbox.progress;
  if (progress === null || progress.of === 0) return SKY_AT.dawn;
  return SKY_AT.dawn * (1 - (DAWN_LIFTS * progress.done) / progress.of);
}

export const readInboxSky = (): InboxSky => sky;

function subscribeInboxSky(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The sky's reading of Input: `skyOver` for where it stands, `clears` growing for the sunrise. */
export const useInboxSky = (): InboxSky =>
  useSyncExternalStore(subscribeInboxSky, readInboxSky, readInboxSky);
