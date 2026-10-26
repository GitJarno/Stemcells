/**
 * Aski's planner on the primary server (`apps/server/src/stemcells/planner/http.ts`): one
 * lean structured call on the model the web names, and each project's one line. Requests
 * authenticate as upstream's do (a browser's session cookie, else the desktop's bearer token)
 * and end when the plan is dropped or times out, whatever the server does (`words/plan/wait.ts`).
 */
import type { ProviderInstanceId } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";

import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { readDesktopPrimaryBearerToken } from "~/environments/primary/desktopAuth";

import { type PlannerModel, type PlannerReply, plannerReplyOf } from "../words/plan/think";
import { within } from "../words/plan/wait";

const PLANNER_PATH = "/api/stemcells/planner";
/** The server gives a plan 20 s; past this the server itself is gone. */
const PLAN_WAIT_MS = 25_000;
/** The lines are a help, not a need: past this the plan goes without them. */
const LINES_WAIT_MS = 2_000;

async function fromPrimary(url: string, init: RequestInit = {}): Promise<Response> {
  const bearerToken = await readDesktopPrimaryBearerToken();
  return fetch(url, {
    ...init,
    credentials: bearerToken ? "omit" : "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
    },
  });
}

/** One call to the planner, ending when `signal` aborts or at its time; never throws. */
export function askPlanner(
  prompt: string,
  model: PlannerModel,
  signal: AbortSignal,
): Promise<PlannerReply> {
  const modelSelection = createModelSelection(
    model.instanceId as ProviderInstanceId,
    model.model,
    model.effort ? [{ id: model.effort.option, value: model.effort.level }] : [],
  );
  return within(
    async (stop) => {
      const response = await fromPrimary(resolvePrimaryEnvironmentHttpUrl(PLANNER_PATH), {
        method: "POST",
        body: JSON.stringify({ prompt, modelSelection }),
        signal: stop,
      });
      return plannerReplyOf(response.status, response.ok ? await response.json() : null);
    },
    (end): PlannerReply => ({ ok: false, reason: end === "late" ? "timeout" : "failed" }),
    signal,
    PLAN_WAIT_MS,
  );
}

/**
 * Each project's one line, by project id; a project the server can't read
 * has none, and so does every one once `signal` aborts or the lines take
 * too long. Never throws.
 */
export function readProjectLines(
  projectIds: readonly string[],
  signal: AbortSignal,
): Promise<ReadonlyMap<string, string>> {
  const none = (): ReadonlyMap<string, string> => new Map();
  if (projectIds.length === 0) return Promise.resolve(none());
  return within(
    async (stop) => {
      const url = new URL(resolvePrimaryEnvironmentHttpUrl(`${PLANNER_PATH}/lines`));
      for (const id of projectIds) url.searchParams.append("project", id);
      const response = await fromPrimary(url.toString(), { signal: stop });
      if (!response.ok) return none();
      const { lines } = (await response.json()) as { lines?: Record<string, unknown> };
      return new Map(
        Object.entries(lines ?? {}).flatMap(([id, line]) =>
          typeof line === "string" ? [[id, line] as const] : [],
        ),
      );
    },
    none,
    signal,
    LINES_WAIT_MS,
  );
}

/** Adds one plan to the plan history on this machine; never throws. */
export async function recordPlan(record: Record<string, unknown>): Promise<void> {
  try {
    await fromPrimary(resolvePrimaryEnvironmentHttpUrl(`${PLANNER_PATH}/history`), {
      method: "POST",
      body: JSON.stringify(record),
    });
  } catch {
    // The history is a record, never a reason a Cell doesn't start.
  }
}
