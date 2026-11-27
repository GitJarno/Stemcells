// The home's stages in their own order over T3's list (`substitutes/useThreadListV2.ts`,
// stemcells/tasks/awake-asleep.md). Awake reads in time order: pins first in T3's order, then by
// the time each row shows, latest first. Asleep lists the latest asleep first, and a timed sleep
// says when it wakes. The stage is the shelf, so T3's shelf rows go.

import { snoozeWakeLabel } from "@t3tools/client-runtime/state/thread-settled";
import { resolveSettledThreadTimestamp } from "@t3tools/client-runtime/state/thread-sort";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

import type { ThreadListV2ListItem } from "../../features/threads/threadListV2";
import { byRecent, type Launchable, wakesWords } from "../line/kit";
import { cellKey, type CellState } from "../line/line";

type ThreadItem = Extract<ThreadListV2ListItem, { readonly type: "v2-thread" }>;

const isThread = (item: ThreadListV2ListItem): item is ThreadItem => item.type === "v2-thread";

function launchableOf(item: ThreadItem): Launchable & { readonly item: ThreadItem } {
  const { thread } = item.item;
  const requestedAt = thread.latestRun?.requestedAt ?? null;
  return {
    id: thread.id,
    createdAt: thread.createdAt,
    unsettledAt: thread.unsettledAt,
    snoozedUntil: thread.snoozedUntil,
    latestUserAuthoredMessageAt: thread.latestUserAuthoredMessageAt,
    latestRun: requestedAt === null ? null : { requestedAt },
    item,
  };
}

/** Awake: new chats on their way, the pins in T3's order, then by the time each row shows. */
export function inAwakeOrder(
  items: ReadonlyArray<ThreadListV2ListItem>,
  states: ReadonlyMap<string, CellState>,
): ThreadListV2ListItem[] {
  const threads = items.filter(isThread);
  return [
    ...items.filter((item) => item.type === "v2-pending"),
    ...threads.filter((item) => item.item.pinned),
    ...byRecent(
      threads.filter((item) => !item.item.pinned).map(launchableOf),
      ({ item }) => states.get(cellKey(item.item.thread))?.since,
    ).map((launched) => launched.item),
  ];
}

const msOf = (iso: string | null | undefined) => {
  const ms = Date.parse(iso ?? "");
  return Number.isNaN(ms) ? 0 : ms;
};

function asleepAt(item: ThreadItem): number {
  const { thread } = item.item;
  return msOf(item.item.snoozed ? thread.snoozedAt : resolveSettledThreadTimestamp(thread));
}

/** When a timed sleep wakes, at `now` (an ISO time). */
function wakesAt(thread: Pick<EnvironmentThreadShell, "snoozedUntil">, now: string) {
  const until = thread.snoozedUntil ?? "";
  return wakesWords(msOf(until) <= msOf(now) ? "now" : `in ${snoozeWakeLabel(until, { now })}`);
}

/** Asleep: the latest asleep first, a timed sleep saying when it wakes, at `now` (an ISO time). */
export function inAsleepOrder(
  items: ReadonlyArray<ThreadListV2ListItem>,
  now: string,
): ThreadListV2ListItem[] {
  const at = new Map(items.filter(isThread).map((item) => [item, asleepAt(item)]));
  // The phone's Hermes has no toSorted.
  return [...at.keys()]
    .sort(
      (a, b) =>
        at.get(b)! - at.get(a)! ||
        (a.item.thread.id < b.item.thread.id ? -1 : a.item.thread.id > b.item.thread.id ? 1 : 0),
    )
    .map((item) =>
      item.item.snoozed ? { ...item, snoozeWakeLabelText: wakesAt(item.item.thread, now) } : item,
    );
}
