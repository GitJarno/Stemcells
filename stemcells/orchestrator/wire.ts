// What a client and the server say to each other about plans
// (`apps/server/src/stemcells/aski/compileHttp.ts`). Both clients speak it the same way.

import { flat } from "./names.ts";
import type { CompileContext, Plan, Selection } from "./plan.ts";

export const ASKI_PATH = "/api/stemcells/aski";
/** POST: a plan is about to be made from a message to Aski's chat; that chat's turn waits for it. */
export const EXPECT_PATH = `${ASKI_PATH}/expect`;
/** POST: the message as a plan. */
export const COMPILE_PATH = `${ASKI_PATH}/compile`;
/** GET ?id=: a plan and what came of it (a plan Aski's chat proposed is read this way). */
export const PLAN_PATH = `${ASKI_PATH}/plan`;
/** GET ?thread=: the plans made in one of Aski's chats, newest first, each with what came of it. */
export const PLANS_PATH = `${ASKI_PATH}/plans`;
/** POST: a Cell the server is to start itself: one that comes after others, or gets a worktree. */
export const QUEUE_PATH = `${ASKI_PATH}/queue`;
/** POST: what came of a plan's acts, and the names the person confirmed. */
export const OUTCOME_PATH = `${ASKI_PATH}/outcome`;
/** GET, DELETE: the names Aski has learned. */
export const LEARNED_PATH = `${ASKI_PATH}/learned`;

export interface ExpectRequest {
  readonly id: string;
  readonly threadId: string;
  readonly text: string;
}

export interface CompileRequest extends ExpectRequest {
  readonly context: Pick<CompileContext, "places" | "models" | "cells"> &
    Partial<Pick<CompileContext, "cap" | "always" | "dictated">>;
  /** The model the compiler's first call runs on, and its second (the first's when absent). */
  readonly think: { readonly fast: Selection; readonly strong?: Selection };
}

export interface CompileReply {
  readonly plan: Plan;
  readonly ms: number;
}

export interface OutcomeRequest {
  readonly id: string;
  readonly acts: ReadonlyArray<{
    readonly i: number;
    readonly status:
      | "started"
      | "waiting"
      | "queued"
      | "dropped"
      | "failed"
      | "called-back"
      | "done";
    readonly reason?: string;
  }>;
  readonly learned?: {
    readonly places: ReadonlyArray<{ readonly heard: string; readonly name: string }>;
    readonly models: ReadonlyArray<{ readonly heard: string; readonly name: string }>;
  };
}

/** The fence Aski's chat shows a proposed plan with: ```plan, then the plan's id on a line. */
export const PLAN_FENCE = "plan";
/**
 * The plan id a fence's body names; null when it names none. A plan's id is a UUID and the body
 * is nothing else, so a `plan` block someone wrote for another reason stays the code it is.
 */
export function planIdOfFence(body: string): string | null {
  const id = body.trim();
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(id) ? id : null;
}

/**
 * The models the compiler thinks with, from the person's own: the fast one first (a miss costs
 * a tap, since code checks its answer), and a stronger one for the second call. Claude's are
 * told by their family; another provider's default serves for both.
 */
export function thinkWith(
  models: ReadonlyArray<{
    readonly instanceId: string;
    readonly id: string;
    readonly effortOption?: string;
    readonly efforts: readonly string[];
  }>,
  instanceId: string,
): { fast: Selection; strong?: Selection } | null {
  const own = models.filter((model) => model.instanceId === instanceId);
  if (own.length === 0) return null;
  const selectionOf = (model: (typeof own)[number]): Selection => ({
    instanceId: model.instanceId,
    model: model.id,
    ...(model.effortOption !== undefined && model.efforts.includes("low")
      ? { options: [{ id: model.effortOption, value: "low" }] }
      : {}),
  });
  const family = (word: string) => own.find((model) => model.id.toLowerCase().includes(word));
  const fast = family("haiku") ?? own[0]!;
  const strong = family("sonnet") ?? family("opus");
  return {
    fast: selectionOf(fast),
    ...(strong !== undefined && strong !== fast ? { strong: selectionOf(strong) } : {}),
  };
}

/** A plan as the server keeps it, for the card under the message it was made from. */
export interface KeptPlan {
  readonly id: string;
  /** When it was made, in epoch milliseconds. */
  readonly at: number;
  /** The message it was made from, once that message's turn began; null until then. */
  readonly messageId: string | null;
  /** That message's words, as `planWords` reads them. */
  readonly words: string;
  readonly plan: Plan;
  readonly outcome: ReadonlyArray<{
    readonly i: number;
    readonly status: OutcomeRequest["acts"][number]["status"];
    readonly reason?: string | undefined;
  }> | null;
}

export interface PlansReply {
  readonly plans: ReadonlyArray<KeptPlan>;
}

// A Cell's chip in a message (upstream's thread context link) says what Aski should look at;
// it is no part of the words a plan was made from. The server's `askiPlans.contract.test.ts`
// pins its form.
const CHIP = /\[[^[\]\n]*\]\(t3-context:\/\/v1\/thread\/[^\s)]+\)/gu;

/** A message's words as a plan is matched to it: no chip, one case, single spaces. */
export const planWords = (text: string): string => flat(text.replace(CHIP, " "));

/** How long after a plan a message with its words still counts as that plan's message. */
export const PLAN_NOTE_MS = 2 * 60_000;

/**
 * The plan a message in Aski's chat was made into: the one the server tied to it, else the
 * latest untied one made from the same words within `PLAN_NOTE_MS` of it.
 */
export function planOfMessage(
  plans: ReadonlyArray<KeptPlan>,
  message: { readonly id: string; readonly text: string; readonly at: number },
): KeptPlan | null {
  const tied = plans.find((plan) => plan.messageId === message.id);
  if (tied !== undefined) return tied;
  const words = planWords(message.text);
  let found: KeptPlan | null = null;
  for (const plan of plans) {
    if (plan.messageId !== null || plan.words !== words) continue;
    if (Math.abs(plan.at - message.at) > PLAN_NOTE_MS) continue;
    if (found === null || plan.at > found.at) found = plan;
  }
  return found;
}

/**
 * A Cell handed to the server to start (decisions 16 and 17), with what the client would have
 * started it with. Its words are the server's own copy of the plan's.
 */
export interface QueueRequest {
  readonly id: string;
  readonly i: number;
  readonly projectId: string;
  /** The model as a launch takes it. */
  readonly modelSelection: Selection;
  readonly runtimeMode: string;
  readonly interactionMode: string;
  /** In a worktree of its own, when the project's folder is a repository. */
  readonly worktree: boolean;
  /** The person won't wait for the Cells it comes after: it starts at once, where they work. */
  readonly now?: boolean;
}

export type QueueReply = { readonly ok: true } | { readonly ok: false; readonly error: string };
