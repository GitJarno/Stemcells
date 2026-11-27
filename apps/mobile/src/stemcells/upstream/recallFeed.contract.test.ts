import {
  MessageId,
  RunId,
  ThreadId,
  TurnItemId,
  type OrchestrationV2ProjectedTurnItem,
  type OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { buildThreadFeed, deriveThreadFeedPresentation } from "../../lib/threadActivity";
import type { RecallAnswer } from "../recall/kit";
import { withRecall } from "../recall/feed";
import { ownWordsOf } from "./recallFeed";

/**
 * Contract: an entry of ours, shaped as a reply with no run, stays in the feed upstream
 * presents: a finished turn folds its work and never ours, and the zen view, which hides a
 * turn's passing replies, keeps it. A failure after a sync means the Cells a question found no
 * longer show on the phone.
 */

const threadId = ThreadId.make("thread-aski");
const runId = RunId.make("run-1");

function item(id: string, ordinal: number, more: object): OrchestrationV2ProjectedTurnItem {
  const at = DateTime.makeUnsafe(`2026-11-27T10:00:0${ordinal}.000Z`);
  const turnItem = {
    id: TurnItemId.make(id),
    threadId,
    runId,
    nodeId: null,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    parentItemId: null,
    ordinal,
    status: "completed" as const,
    title: null,
    startedAt: at,
    completedAt: at,
    updatedAt: at,
    ...more,
  } as OrchestrationV2TurnItem;
  return {
    position: ordinal,
    visibility: "local",
    sourceThreadId: threadId,
    sourceItemId: turnItem.id,
    item: turnItem,
  };
}

/** A finished turn in Aski's chat: the question, a tool call, a passing reply, the answer. */
const turn = buildThreadFeed([
  item("ask", 0, {
    type: "user_message",
    messageId: MessageId.make("message-ask"),
    createdBy: "user",
    creationSource: "mobile",
    inputIntent: "turn_start",
    text: "where was the film page chat yesterday?",
    attachments: [],
  }),
  item("tool", 1, { type: "command_execution", input: "recall", output: "ok", exitCode: 0 }),
  item("passing", 2, {
    type: "assistant_message",
    messageId: MessageId.make("message-passing"),
    text: "Looking.",
    streaming: false,
  }),
  item("answer", 3, {
    type: "assistant_message",
    messageId: MessageId.make("message-answer"),
    text: "It was Film detail page.",
    streaming: false,
  }),
]);

const found: RecallAnswer = {
  cards: [
    { link: "[Film detail page](t3-thread://v2/environment-mac/thread-film)" },
    { link: "[Film hero](t3-thread://v2/environment-mac/thread-hero)" },
  ] as never,
  more: 3,
  read: { from: null, to: null, project: null, words: ["film", "page"], widened: false },
};

const NOTE =
  "[Film detail page](t3-thread://v2/environment-mac/thread-film)  [Film hero](t3-thread://v2/environment-mac/thread-hero)  and 3 more";

describe("the Cells a question found, in upstream's feed", () => {
  const fed = withRecall(turn, (id) => (id === "message-ask" ? found : null), new Map());

  it("stand under the question as a reply's Markdown, their links the Cells' chips", () => {
    expect(
      fed.map((entry) => (entry.type === "message" ? entry.message.text : entry.type)),
    ).toEqual([
      "where was the film page chat yesterday?",
      NOTE,
      "activity-group",
      "Looking.",
      "It was Film detail page.",
    ]);
    expect(ownWordsOf(fed[0]!)).toBe("where was the film page chat yesterday?");
    // Ours is not the person's, so it is never read as a question itself.
    expect(ownWordsOf(fed[1]!)).toBeNull();
  });

  it.each(["showAll", "zen"] as const)("stay when the turn folds, in the %s view", (view) => {
    const shown = deriveThreadFeedPresentation(
      fed,
      null,
      new Set(),
      new Set(),
      null,
      false,
      undefined,
      {
        toolCallVisibility: view,
        revealedMessageId: null,
      },
    );
    const texts = shown.map((entry) =>
      entry.type === "message" ? entry.message.text : entry.type,
    );
    expect(texts.slice(0, 2)).toEqual(["where was the film page chat yesterday?", NOTE]);
    expect(texts.at(-1)).toBe("It was Film detail page.");
    // The turn's own passing reply is folded or hidden; ours never is.
    expect(texts).not.toContain("Looking.");
  });

  it("is the feed itself when no question found a Cell, and the same row when drawn again", () => {
    const made = new Map();
    expect(withRecall(turn, () => null, made)).toBe(turn);
    expect(withRecall(turn, () => ({ ...found, cards: [], more: 0 }), made)).toBe(turn);
    const once = withRecall(turn, () => found, made);
    expect(withRecall(turn, () => found, made)[1]).toBe(once[1]);
  });
});
