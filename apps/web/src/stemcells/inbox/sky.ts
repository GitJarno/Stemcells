/**
 * What the sky reads of Input (stemcells/tasks/inbox.md, decisions 6 and 7): how far through a
 * clearing the person is, for the dawn's steps, and a count of all-clears, each the sunrise's
 * cue. One store per app: the Mac's column and the phone's home each publish theirs.
 */
import { useSyncExternalStore } from "react";

export interface InboxSky {
  /** Asks answered of all the clearing met; null outside a clearing. */
  readonly progress: { readonly done: number; readonly of: number } | null;
  /** How many clearings have ended: a new one is the sunrise. */
  readonly clears: number;
}

let sky: InboxSky = { progress: null, clears: 0 };
const listeners = new Set<() => void>();

function set(next: InboxSky) {
  sky = next;
  for (const listener of listeners) listener();
}

export function publishProgress(progress: InboxSky["progress"]): void {
  if (progress?.done === sky.progress?.done && progress?.of === sky.progress?.of) return;
  set({ ...sky, progress });
}

/** The last ask of a clearing was answered: the sun rises (day-night.md's `riseSky`, once it lands). */
export function allClear(): void {
  set({ progress: null, clears: sky.clears + 1 });
}

const readInboxSky = (): InboxSky => sky;

function subscribeInboxSky(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * What the sky reads (day-night.md): its dawn steps by `progress`, and it rises as `clears`
 * grows. Public until the sky lands to read it.
 * @public
 */
export const useInboxSky = (): InboxSky =>
  useSyncExternalStore(subscribeInboxSky, readInboxSky, readInboxSky);
