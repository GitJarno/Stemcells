/**
 * Upstream's chat timeline as the work verbs read it: the entries that start a turn, in order,
 * by upstream's private rule (`timelineEntryStartsResponse` in `MessagesTimeline.logic.ts`): the
 * person's words start one unless they steer the one running; a notification starts its own.
 * `workVerbs.contract.test.ts` pins it, with the labels the verbs swap a word in.
 */
import type { TimelineEntry } from "../../session-logic";

export type TimelineEntries = ReadonlyArray<TimelineEntry>;

/** Where a turn starts: the id it keeps, the person's words, and when. */
export interface TurnStart {
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
}

/** Words sent while a turn runs: they join it rather than start one. */
const STEERS: ReadonlySet<string> = new Set(["steer", "promoted_queued_to_steer"]);

export function turnStartsOf(entries: TimelineEntries): TurnStart[] {
  return entries.flatMap((entry): TurnStart[] => {
    if (entry.kind === "message") {
      const { message } = entry;
      if (message.role !== "user" || STEERS.has(message.inputIntent ?? "")) return [];
      return [{ id: message.id, text: message.text, createdAt: entry.createdAt }];
    }
    // A notification has no words of the person's: the general pool.
    if (entry.kind === "work" && entry.entry.itemType === "notification") {
      return [{ id: entry.id, text: "", createdAt: entry.createdAt }];
    }
    return [];
  });
}
