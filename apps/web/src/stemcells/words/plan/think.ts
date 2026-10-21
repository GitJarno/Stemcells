/**
 * Aski thinks a plan through (stemcells/tasks/prompting.md, decision 11):
 * one call, its answer checked by code, one retry that names what failed,
 * else the floor. How the call travels is `upstream/planner.ts`'s; what
 * came back is read here (`plannerReplyOf`).
 */
import { ASKI_DRIVERS } from "../../aski/setup";
import type { WordsCatalog } from "../catalog";
import type { Launch } from "../cells";
import type { WordsPlace } from "../places";
import { type PlanAsk, plannerPrompt } from "./ask";
import { checkAnswer } from "./check";
import { floorOf, joined, type Plan } from "./plan";
import { within } from "./wait";

/** What one call to the planner came back with. */
export type PlannerReply =
  | { readonly ok: true; readonly answer: unknown }
  | {
      readonly ok: false;
      /** "failed": one more is worth it when it failed fast; never after a timeout. */
      readonly reason: "timeout" | "failed" | "unavailable";
      /** The server refused the request itself (401, 403, 413): asked again, it refuses again. */
      readonly refused?: boolean;
    };

/** A failure faster than this was a hiccup, worth one more call; a slower one would double the wait. */
export const FAST_FAILURE_MS = 5_000;

export type PlannerCall = (prompt: string) => Promise<PlannerReply>;

/** One call, as the plan history keeps it (decision 19). */
export interface Try {
  readonly ms: number;
  /** An answer came, or why none did. */
  readonly came: "answer" | PlannerReplyFailure;
  readonly answer?: unknown;
  /** The checks its answer failed. */
  readonly failed?: readonly string[];
}

type PlannerReplyFailure = Extract<PlannerReply, { ok: false }>["reason"];

/** The model Aski thinks with: one structured call, run lean. */
export interface PlannerModel {
  readonly instanceId: string;
  readonly driver: string;
  readonly model: string;
  readonly effort: { readonly option: string; readonly level: string } | null;
}

/** What the readout says over the floor, by why it came back. */
export const FLOOR_WHY = {
  failed: "Aski couldn't divide this",
  timeout: "Aski took too long to divide this",
  unavailable: "Aski can't divide this now",
} as const;

/**
 * What the planner's route answered, by its status and body. A request
 * the server refused (a 4xx: not signed in, not allowed, too large) is
 * never asked again; any other failure may be.
 */
export function plannerReplyOf(status: number, body: unknown): PlannerReply {
  if (status >= 400 && status < 500) return { ok: false, reason: "failed", refused: true };
  if (status < 200 || status >= 300 || typeof body !== "object" || body === null)
    return { ok: false, reason: "failed" };
  const reply = body as {
    readonly ok?: unknown;
    readonly answer?: unknown;
    readonly reason?: unknown;
  };
  if (reply.ok === true) return { ok: true, answer: reply.answer };
  return {
    ok: false,
    reason: reply.reason === "timeout" || reply.reason === "unavailable" ? reply.reason : "failed",
  };
}

/**
 * Aski's provider's own instance (Claude, else Codex), ready to run: its
 * strongest model, else its default, at low effort (decision 11). Null
 * when neither can run now, or the person turned Aski's planning off
 * (`plans`, Settings › Aski): then the words alone set the Cells up.
 */
export function plannerModel(
  catalog: WordsCatalog,
  ready: (instanceId: string) => boolean,
  plans = true,
): PlannerModel | null {
  if (!plans) return null;
  for (const driver of ASKI_DRIVERS) {
    const provider = catalog.providers.find((p) => p.id === driver && ready(p.id));
    const model =
      provider?.models.find((m) => m.aliases?.includes("opus")) ??
      provider?.models.find((m) => m.id === provider.defaultModel) ??
      provider?.models[0];
    if (!provider || !model) continue;
    const effort =
      model.effortOption && model.efforts.includes("low")
        ? { option: model.effortOption, level: "low" }
        : null;
    return { instanceId: provider.id, driver, model: model.id, effort };
  }
  return null;
}

/**
 * The plan for `launch`: the checked answer, else the floor. `limit` says
 * the planner's plan is spent: then no call goes, and the floor says so.
 * Null once `signal` aborts (the words changed, or Esc dropped the plan),
 * at once, even while a call hangs.
 */
export async function thinkThrough(input: {
  readonly ask: PlanAsk;
  readonly launch: Launch;
  readonly roster: readonly WordsPlace[];
  readonly call: PlannerCall;
  readonly limit: string | null;
  readonly signal: AbortSignal;
  /** The time in milliseconds, for how fast a call failed. */
  readonly now?: () => number;
  /** Each call as it comes back. */
  readonly tried?: (one: Try) => void;
}): Promise<Plan | null> {
  const { ask, launch, roster, call, signal } = input;
  const now = input.now ?? Date.now;
  if (input.limit !== null) return floorOf(launch, ask.task, input.limit);
  let failed: readonly string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const asked = now();
    const prompt = plannerPrompt(ask, failed);
    const reply = await within(
      () => call(prompt),
      (): PlannerReply => ({ ok: false, reason: "failed" }),
      signal,
      null,
    );
    const ms = Math.round(now() - asked);
    if (signal.aborted) return null;
    if (!reply.ok) {
      input.tried?.({ ms, came: reply.reason });
      // Only a fast failure gets one more call: a slow one would double the
      // wait, and a refused one fails the same again.
      const again = reply.reason === "failed" && !reply.refused && ms < FAST_FAILURE_MS;
      if (!again) return floorOf(launch, ask.task, FLOOR_WHY[reply.reason]);
      failed = [];
      continue;
    }
    const checked = checkAnswer(reply.answer, ask, roster);
    input.tried?.({
      ms,
      came: "answer",
      answer: reply.answer,
      ...(checked.ok ? {} : { failed: checked.failed }),
    });
    if (checked.ok) return joined(launch, checked.cells);
    failed = checked.failed;
  }
  return floorOf(launch, ask.task, FLOOR_WHY.failed);
}
