// The Cells a question in Aski's chat found, on the phone, under the question in its feed
// (stemcells/tasks/aski-orchestrator.md, decision 8). A machine reached through T3's relay has
// no line of ours, so its questions keep Aski's own answer alone.

import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { askMachine } from "../upstream/machines";
import { ownWordsOf, type ThreadFeedEntry } from "../upstream/recallFeed";
import { type Made, withRecall } from "./feed";
import { keyOf, readRecallOf, useRecallAnswers } from "./read";

/** The questions read when a chat opens: its latest, since each is a request. */
const LATEST = 12;

/** The person's own latest messages in a feed: the ones a chat opening reads recall for. */
function latestOwn(feed: ReadonlyArray<ThreadFeedEntry>) {
  const own: Array<{ readonly id: string; readonly text: string; readonly at: number }> = [];
  for (let index = feed.length - 1; index >= 0 && own.length < LATEST; index--) {
    const entry = feed[index]!;
    const text = ownWordsOf(entry);
    if (text !== null) own.push({ id: entry.id, text, at: Date.parse(entry.createdAt) });
  }
  return own;
}

/** The id of the feed's last message in the person's seat: a new one is a new question to read. */
function lastAsked(feed: ReadonlyArray<ThreadFeedEntry>): string | null {
  for (let index = feed.length - 1; index >= 0; index--) {
    const entry = feed[index]!;
    if (entry.type === "message" && entry.message.role === "user") return entry.id;
  }
  return null;
}

/**
 * The feed of a chat with the Cells each question found under it, while `on`: Aski's chat
 * alone. Any other chat's feed comes back as it is.
 */
export function useRecallFeed(
  feed: ReadonlyArray<ThreadFeedEntry>,
  environmentId: string,
  on: boolean,
): ReadonlyArray<ThreadFeedEntry> {
  const answers = useRecallAnswers();
  const [made] = useState<Made>(() => new Map());
  const asked = on ? lastAsked(feed) : null;
  const read = useEffectEvent(() => {
    for (const message of latestOwn(feed)) {
      void readRecallOf(environmentId, message.id, message.text, message.at, askMachine);
    }
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Ask the chat's machine, once a message, for the Cells its question names; a reply streaming in is no new question.
  useEffect(() => {
    if (asked !== null) read();
  }, [asked]);
  // The same feed and answers give the same array: upstream's feed derives its rows from it.
  return useMemo(
    () =>
      on ? withRecall(feed, (id) => answers.get(keyOf(environmentId, id)) ?? null, made) : feed,
    [feed, answers, environmentId, on, made],
  );
}
