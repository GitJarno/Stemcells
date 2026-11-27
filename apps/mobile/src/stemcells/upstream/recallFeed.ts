// What the Cells a question found take from upstream on the phone: the feed's entries, which
// messages are the person's own, and a reply-shaped entry of ours, whose Markdown upstream's
// feed draws with every thread link as a chip that opens its chat.

import { MessageId } from "@t3tools/contracts";
import { resolveUserMessagePresentation } from "@t3tools/client-runtime/user-message";

import type { ThreadFeedEntry } from "../../lib/threadActivity";

export type { ThreadFeedEntry };
export type MessageEntry = Extract<ThreadFeedEntry, { readonly type: "message" }>;

/** The words of a message the person wrote themselves; null for a Cell's, a guest's or the app's. */
export function ownWordsOf(entry: ThreadFeedEntry): string | null {
  if (entry.type !== "message" || entry.message.role !== "user") return null;
  if (entry.message.senderThreadId !== undefined || entry.message.linkedSender !== undefined) {
    return null;
  }
  const presented = resolveUserMessagePresentation(entry.message);
  return presented.attribution === null ? presented.text : null;
}

/**
 * An entry of ours for the feed to draw under `under`, as a reply with no run: it belongs to
 * no turn, so no fold hides it and it carries no reply's actions.
 */
export function noteUnder(under: MessageEntry, kind: string, markdown: string): MessageEntry {
  const id = MessageId.make(`${kind}:${under.message.id}`);
  return {
    type: "message",
    id,
    createdAt: under.createdAt,
    message: {
      id,
      role: "assistant",
      text: markdown,
      attachments: [],
      runId: null,
      streaming: false,
      visibility: "synthetic",
      sourceThreadId: under.message.sourceThreadId,
      createdAt: under.message.createdAt,
      updatedAt: under.message.createdAt,
    },
  };
}
