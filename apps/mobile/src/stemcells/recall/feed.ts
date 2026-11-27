// The phone's feed with the Cells each question found under it (stemcells/tasks/
// aski-orchestrator.md, decision 8), as one more entry upstream's feed draws: its links are
// the Cells' pills. Pure; the entries it makes are kept, so a list sees the same row again.

import { pillsMarkdown, type RecallAnswer } from "./kit";
import { noteUnder, type MessageEntry, type ThreadFeedEntry } from "../upstream/recallFeed";

/** The entries made so far, by message and by what they say. */
export type Made = Map<string, MessageEntry>;

/** `feed` with what each question found under it; `feed` itself when no question found any. */
export function withRecall(
  feed: ReadonlyArray<ThreadFeedEntry>,
  /** By message id; `answerOf` says nothing for a message that asked nothing. */
  answerOf: (messageId: string) => RecallAnswer | null,
  made: Made,
): ReadonlyArray<ThreadFeedEntry> {
  let next: ThreadFeedEntry[] | null = null;
  for (const [index, entry] of feed.entries()) {
    const answer =
      entry.type === "message" && entry.message.role === "user" ? answerOf(entry.id) : null;
    const markdown = answer === null ? "" : pillsMarkdown(answer);
    if (entry.type !== "message" || markdown === "") {
      next?.push(entry);
      continue;
    }
    next ??= feed.slice(0, index);
    const key = `${entry.id}\n${markdown}`;
    const note = made.get(key) ?? noteUnder(entry, "recall", markdown);
    made.set(key, note);
    next.push(entry, note);
  }
  return next ?? feed;
}
