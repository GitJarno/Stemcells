/**
 * The entries each chat's timeline draws, by thread key, for the media viewer. Upstream's
 * `ChatView` keeps streamed replies out of its entries so a delta never re-renders it; our
 * `MessagesTimeline` substitute publishes what it draws and only an open viewer reads it, so a
 * closed one costs nothing while a reply streams. With two panes on one chat, the last wins.
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
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Publish what the timeline draws to the media viewer's store before paint.
  useLayoutEffect(
    () => publishChatEntries(threadKey, timeline, entries),
    [timeline, threadKey, entries],
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Withdraw this timeline's entries when its thread changes or it unmounts.
  useLayoutEffect(() => () => withdrawChatEntries(threadKey, timeline), [timeline, threadKey]);
}

/** The entries the chat's timeline draws: every row, streamed replies too. */
export function useChatEntries(threadKey: string): TimelineEntries {
  return useSyncExternalStore(subscribe, () => chatEntriesOf(threadKey));
}
