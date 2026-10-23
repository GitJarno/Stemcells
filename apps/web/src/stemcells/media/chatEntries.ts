/**
 * The entries each chat's timeline draws, by its thread key, for the chat's
 * media viewer. Upstream's `ChatView` keeps streamed replies out of its own
 * entries, so a delta never re-renders it (#23117); only the timeline draws
 * every row. Our `MessagesTimeline` substitute publishes what it draws, and
 * only an open viewer reads it, so a closed one costs nothing while a reply
 * streams. Two panes on one chat each publish; the viewer reads the last.
 */
import { useLayoutEffect, useState, useSyncExternalStore } from "react";

import type { TimelineEntries } from "../upstream/media";

const NONE: TimelineEntries = [];
const drawn = new Map<string, Map<object, TimelineEntries>>();
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishChatEntries(
  threadKey: string,
  timeline: object,
  entries: TimelineEntries,
): void {
  let byTimeline = drawn.get(threadKey);
  if (byTimeline === undefined) drawn.set(threadKey, (byTimeline = new Map()));
  byTimeline.set(timeline, entries);
  changed();
}

export function withdrawChatEntries(threadKey: string, timeline: object): void {
  const byTimeline = drawn.get(threadKey);
  if (byTimeline?.delete(timeline) !== true) return;
  if (byTimeline.size === 0) drawn.delete(threadKey);
  changed();
}

export function chatEntriesOf(threadKey: string): TimelineEntries {
  let last = NONE;
  for (const entries of drawn.get(threadKey)?.values() ?? []) last = entries;
  return last;
}

/** Publishes the entries a timeline draws, while it's mounted. */
export function usePublishChatEntries(threadKey: string, entries: TimelineEntries): void {
  const [timeline] = useState(() => ({}));
  useLayoutEffect(
    () => publishChatEntries(threadKey, timeline, entries),
    [timeline, threadKey, entries],
  );
  useLayoutEffect(() => () => withdrawChatEntries(threadKey, timeline), [timeline, threadKey]);
}

/** The entries the chat's timeline draws: every row, streamed replies too. */
export function useChatEntries(threadKey: string): TimelineEntries {
  return useSyncExternalStore(subscribe, () => chatEntriesOf(threadKey));
}
