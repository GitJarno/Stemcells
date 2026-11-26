// Aski's button turns the chat in front over to Aski and back (stemcells/tasks/aski-side.md).
// What's in front, where a turn goes, and what the button remembers to come back to.

import { useSyncExternalStore } from "react";

import type { ShowStage } from "../../../../../stemcells/aski/show.ts";

export type Where =
  | { readonly kind: "home" }
  | { readonly kind: "cell"; readonly environmentId: string; readonly threadId: string };

export interface AskiRef {
  readonly environmentId: string;
  readonly threadId: string;
}

const THREAD_PATH = /^\/threads\/([^/?#]+)\/([^/?#]+)/;

/** What's in front, from the workspace's route; null where Aski's button has no place (Settings, a pull request, a draft). */
export function whereOf(routeName: string | undefined, pathname: string): Where | null {
  if (routeName === "Home") return { kind: "home" };
  if (routeName !== "Thread") return null;
  const match = THREAD_PATH.exec(pathname);
  if (match === null) return null;
  return {
    kind: "cell",
    environmentId: decodeURIComponent(match[1]!),
    threadId: decodeURIComponent(match[2]!),
  };
}

export const isAski = (where: Where | null, aski: AskiRef | null): boolean =>
  where?.kind === "cell" &&
  aski !== null &&
  where.threadId === aski.threadId &&
  where.environmentId === aski.environmentId;

/** Where a tap goes from `here`, and what it leaves to come back to. */
export function turnFrom(
  here: Where,
  aski: AskiRef,
  back: Where | null,
): { readonly go: Where; readonly back: Where | null } {
  if (isAski(here, aski)) return { go: back ?? { kind: "home" }, back: null };
  return { go: { kind: "cell", ...aski }, back: here };
}

let back: Where | null = null;
/** When Aski last stood in front, or was left: its replies after this carry the dot. */
let seenAt = 0;
let asked: ShowStage | null = null;
const listeners = new Set<() => void>();
const changed = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export const backTo = () => back;
export function rememberBack(where: Where | null): void {
  back = where;
  changed();
}
export function useBack(): Where | null {
  return useSyncExternalStore(subscribe, () => back);
}

export function sawAski(at: number): void {
  if (at <= seenAt) return;
  seenAt = at;
  changed();
}
export function useSeenAt(): number {
  return useSyncExternalStore(subscribe, () => seenAt);
}

/** A stage Aski showed, for the home to turn to; the home takes it once. */
export function askStage(stage: ShowStage): void {
  asked = stage;
  changed();
}
export function takeAskedStage(): ShowStage | null {
  const stage = asked;
  asked = null;
  return stage;
}
export function useAskedStage(): ShowStage | null {
  return useSyncExternalStore(subscribe, () => asked);
}

/** Aski answered since the person last had it in front, and isn't still at it. */
export function answeredSince(
  latestRun: { readonly status: string; readonly completedAt: string | null } | null,
  seen: number,
): boolean {
  if (latestRun?.status !== "completed" || latestRun.completedAt === null) return false;
  const done = Date.parse(latestRun.completedAt);
  return !Number.isNaN(done) && done > seen;
}
