/**
 * A card's choice as upstream's thread commands (stemcells/tasks/aski-room.md,
 * "Action catalogue"). Pure: the hold sends what this returns, in order, once
 * its fuse ends and the need is still there. The phone sends the same commands
 * (`apps/mobile/src/stemcells/line/kit.ts`), so nothing here reaches upstream.
 */
import { PHRASES, WAIT_MS, type Choice } from "./card";
import type { ApprovalDecision, Need } from "./wire";

/** One of upstream's thread commands, as a card's option sends it. */
export type ThreadCommand =
  | {
      readonly type: "respond";
      readonly requestId: string;
      readonly decision: ApprovalDecision;
    }
  | {
      readonly type: "answer";
      readonly requestId: string;
      readonly answers: Readonly<Record<string, string | ReadonlyArray<string>>>;
    }
  | { readonly type: "dismissQuestion"; readonly requestId: string }
  | {
      /** A message to the Cell, as its own composer sends one. */
      readonly type: "message";
      readonly text: string;
      readonly interactionMode?: "default" | "plan";
      /** Picks up a run stopped by a limit, as upstream's "Resume thread" does. */
      readonly continuationOfRunId?: string;
      /** Into the running turn ("steer"), or stopping it to start again ("restart"). */
      readonly delivery?: "steer" | "restart";
    }
  /** Upstream's "Implement": out of plan mode, and the plan sent back to build. */
  | { readonly type: "build"; readonly planId: string; readonly markdown: string }
  | { readonly type: "carryOnAtReset"; readonly runId: string; readonly resetAt: string }
  | { readonly type: "snooze"; readonly until: string }
  | { readonly type: "visit"; readonly visitedAt: string }
  /** Done with: the Cell moves to settled, as the sidebar's own Settle does. */
  | { readonly type: "settle" };

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
    case "goAhead":
      return [{ type: "message", text: PHRASES.goAhead }];
    case "didIt":
      return [{ type: "message", text: PHRASES.didIt }];
    case "nothingToDo":
      return [{ type: "settle" }];
    case "nudge":
      return words === "" ? [] : [{ type: "message", text: words, delivery: "steer" }];
    case "stopAndReply":
      return words === "" ? [] : [{ type: "message", text: words, delivery: "restart" }];
    case "wait":
      return [{ type: "snooze", until: new Date(now + WAIT_MS).toISOString() }];
  }
}
