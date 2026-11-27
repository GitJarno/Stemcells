// @effect-diagnostics anyUnknownInErrorContext:off - every toolkit's handlers pass through the guard, each with channels of its own.
/**
 * What Aski's chat can't do (stemcells/tasks/aski-orchestrator.md, decision 7). Aski reads
 * every project and whatever a Cell or a web page wrote, so nothing it reads may turn into a
 * Cell, a project or a deletion: those need the person, through a plan. A call from Aski's
 * instance to one of these tools is refused, whatever mode its chat runs in.
 */
import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";

/** Each refused tool, and what Aski reads instead. */
const REFUSED: Readonly<Record<string, string>> = {
  t3_thread_launch:
    "Aski's chat starts no Cell by itself. Propose it with stemcells_propose: the person starts it with a tap.",
  create_threads:
    "Aski's chat starts no Cell by itself. Propose them with stemcells_propose: the person starts them with a tap.",
  t3_project_create:
    "Aski's chat makes no project. Tell the person to ask for it in their own words (\"a new project called …\"): Stemcells makes it once they confirm.",
  t3_project_clone:
    "Aski's chat makes no project. The person adds one from the app.",
  t3_project_delete:
    "Aski's chat deletes nothing. The person deletes a project with their own hand, in the app: tell them so.",
};

/** `t3_thread_organize` puts Cells to sleep and wakes them, which Aski may; archiving is a deletion. */
const refusedCall = (name: string, params: unknown): string | null => {
  if (name in REFUSED) return REFUSED[name]!;
  if (
    name === "t3_thread_organize" &&
    typeof params === "object" &&
    params !== null &&
    (params as { readonly action?: unknown }).action === "archive"
  )
    return "Aski's chat archives nothing. The person archives a Cell with their own hand, in the app: tell them so.";
  return null;
};

/** `handlers` with Aski's refusals in front; every other caller's calls pass as they are. */
export function guardAskisTools<Handlers extends Record<string, unknown>>(handlers: Handlers): Handlers {
  const guarded: Record<string, unknown> = { ...handlers };
  for (const [name, handler] of Object.entries(handlers)) {
    if (!(name in REFUSED) && name !== "t3_thread_organize") continue;
    const run = handler as (params: unknown) => Effect.Effect<unknown, unknown, unknown>;
    guarded[name] = (params: unknown) =>
      McpInvocationContext.McpInvocationContext.pipe(
        Effect.flatMap((scope) => {
        const refusal =
          scope.thread?.providerInstanceId === ASKI_INSTANCE_ID ? refusedCall(name, params) : null;
        return refusal === null
          ? run(params)
          : Effect.fail(new OrchestratorMcpFailure({ code: "capability_denied", message: refusal }));
        }),
      );
  }
  return guarded as Handlers;
}
