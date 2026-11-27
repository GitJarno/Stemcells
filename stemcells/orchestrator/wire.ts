// What a client and the server say to each other about plans
// (`apps/server/src/stemcells/aski/compileHttp.ts`). Both clients speak it the same way.

import type { CompileContext, Plan, Selection } from "./plan.ts";

export const ASKI_PATH = "/api/stemcells/aski";
/** POST: a plan is about to be made from a message to Aski's chat; that chat's turn waits for it. */
export const EXPECT_PATH = `${ASKI_PATH}/expect`;
/** POST: the message as a plan. */
export const COMPILE_PATH = `${ASKI_PATH}/compile`;
/** GET ?id=: a plan and what came of it (a plan Aski's chat proposed is read this way). */
export const PLAN_PATH = `${ASKI_PATH}/plan`;
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
    readonly status: "started" | "waiting" | "dropped" | "failed" | "called-back" | "done";
    readonly reason?: string;
  }>;
  readonly learned?: {
    readonly places: ReadonlyArray<{ readonly heard: string; readonly name: string }>;
    readonly models: ReadonlyArray<{ readonly heard: string; readonly name: string }>;
  };
}

/** The fence Aski's chat shows a proposed plan with: ```plan, then the plan's id on a line. */
export const PLAN_FENCE = "plan";
/** The plan id a fence's body names; null when it names none. */
export function planIdOfFence(body: string): string | null {
  const id = body.trim().split(/\s+/u)[0] ?? "";
  return /^[\w-]{8,64}$/u.test(id) ? id : null;
}

/**
 * The models the compiler thinks with, from the person's own: the fast one first (a miss costs
 * a tap, since code checks its answer), and a stronger one for the second call. Claude's are
 * told by their family; another provider's default serves for both.
 */
export function thinkWith(
  models: ReadonlyArray<{ readonly instanceId: string; readonly id: string; readonly effortOption?: string; readonly efforts: readonly string[] }>,
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
