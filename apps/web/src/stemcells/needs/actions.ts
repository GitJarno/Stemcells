/**
 * A card's choice as upstream's thread commands (stemcells/tasks/aski-room.md,
 * "Action catalogue"). Pure: the hold sends what this returns, in order, once
 * its fuse ends and the need is still there.
 */
import type { ThreadCommand } from "../upstream/needs";
import { PHRASES, type Choice } from "./card";
import type { Need } from "./wire";

const LATER_MS = 60 * 60 * 1000;

/** What the person gave with the choice: their words, or a question's answers. */
export interface Given {
  readonly words?: string;
  readonly answers?: Readonly<Record<string, string | ReadonlyArray<string>>>;
}

/** The commands a choice sends; empty when the need lacks what the choice needs. */
export function commandsFor(
  need: Need,
  choice: Choice,
  given: Given,
  now: number,
): ReadonlyArray<ThreadCommand> {
  const requestId = need.request?.id;
  const words = given.words?.trim() ?? "";
  const runId = need.limit?.runId ?? need.failure?.runId ?? need.plan?.runId;
  switch (choice.kind) {
    case "decide":
      return requestId === undefined
        ? []
        : [{ type: "respond", requestId, decision: choice.decision }];
    case "declineWithNote":
      return requestId === undefined || words === ""
        ? []
        : [
            { type: "respond", requestId, decision: "decline" },
            { type: "message", text: words },
          ];
    case "answer":
      return requestId === undefined || given.answers === undefined
        ? []
        : [{ type: "answer", requestId, answers: given.answers }];
    case "dismissQuestion":
      return requestId === undefined ? [] : [{ type: "dismissQuestion", requestId }];
    case "build": {
      const plan = need.plan;
      return plan?.id == null || plan.markdown === null
        ? []
        : [{ type: "build", planId: plan.id, markdown: plan.markdown }];
    }
    case "revise":
      return words === "" ? [] : [{ type: "message", text: words, interactionMode: "plan" }];
    case "carryOn": {
      const resetAt = need.limit?.resetAt;
      return runId === undefined || resetAt == null
        ? []
        : [{ type: "carryOnAtReset", runId, resetAt }];
    }
    case "continueNow":
      return runId === undefined
        ? []
        : [{ type: "message", text: PHRASES.continueNow, continuationOfRunId: runId }];
    case "retry":
      return [{ type: "message", text: PHRASES.retry }];
    case "reply":
      return words === "" ? [] : [{ type: "message", text: words }];
    case "dismiss":
      return [{ type: "visit", visitedAt: new Date(now).toISOString() }];
    case "later":
      return [{ type: "snooze", until: new Date(now + LATER_MS).toISOString() }];
  }
}
