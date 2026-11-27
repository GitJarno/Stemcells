// @effect-diagnostics anyUnknownInErrorContext:off - every toolkit's handlers pass through the guard, each with channels of its own.
/**
 * What Aski's chat can't do (stemcells/tasks/aski-orchestrator.md, decision 7). Aski reads
 * every project and whatever a Cell or a web page wrote, so nothing it reads may turn into a
 * Cell, a project or a deletion: those need the person, through a plan. A call to one of these
 * tools from Aski's chat, or from a helper it handed a task to, is refused in every mode.
 */
import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";

const STARTS_NOTHING =
  "Aski's chat starts no Cell by itself. Propose it with stemcells_propose: the person starts it with a tap.";
const MAKES_NOTHING =
  "Aski's chat makes no project. Tell the person to ask for it in their own words (\"a new project called …\"): Stemcells makes it once they confirm.";
const DELETES_NOTHING =
  "Aski's chat deletes nothing. The person deletes it with their own hand, in the app: tell them so.";
const ONLY_A_REMINDER =
  "Aski's chat schedules only a new reminder that comes back to this chat: schedule_task(prompt, schedule), nothing else set. The person changes a schedule in Settings.";

/** Each tool refused to Aski whatever it is called with, and what Aski reads instead. */
export const REFUSED_TO_ASKI: Readonly<Record<string, string>> = {
  t3_thread_launch: STARTS_NOTHING,
  create_threads: STARTS_NOTHING,
  run_scheduled_task_now: STARTS_NOTHING,
  t3_project_create: MAKES_NOTHING,
  t3_project_clone: "Aski's chat makes no project. The person adds one from the app.",
  t3_project_delete: DELETES_NOTHING,
  delete_scheduled_task: DELETES_NOTHING,
};

/** Tools Aski may call one way and not another: `refusedToAski` reads what they are called with. */
const READ_BY_ARGUMENT = new Set(["t3_thread_organize", "schedule_task", "t3_workflow"]);

/** What a workflow call may do from Aski's chat: read. Starting a run starts agents. */
const WORKFLOW_READS = new Set(["list", "read", "questions", "store", "hooks"]);

/**
 * What no agent does, Aski or a Cell: a project leaves the app only by the person's own hand.
 * A Cell told to delete one, in the person's words or in words that only look like theirs,
 * says so instead.
 */
const REFUSED_TO_AGENTS: Readonly<Record<string, string>> = {
  t3_project_delete:
    "No Cell deletes a project. The person deletes one with their own hand, in the app: tell them so.",
};

type Threads = Pick<ThreadManagementService.ThreadManagementService["Service"], "getThreadShell">;

let filed: Threads | null = null;

/**
 * While this scope is open, the refusals to every agent stand, and a helper is known by the
 * chat it descends from.
 */
export const guardStands = (threads: Threads) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      filed = threads;
    }),
    () =>
      Effect.sync(() => {
        if (filed === threads) filed = null;
      }),
  );

/** The guard stands for as long as Stemcells' server layer is up (`layer.ts`). */
export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* guardStands(yield* ThreadManagementService.ThreadManagementService);
  }),
);

const field = (params: unknown, name: string): unknown =>
  typeof params === "object" && params !== null
    ? (params as Readonly<Record<string, unknown>>)[name]
    : undefined;

/**
 * `t3_thread_organize` puts Cells to sleep and wakes them, which Aski may; archiving is a
 * deletion. A schedule is a Cell on a timer, but for a reminder that comes back to Aski's own
 * chat, where these refusals meet it again.
 */
const refusedToAski = (name: string, params: unknown, projectId: string | null): string | null => {
  if (name in REFUSED_TO_ASKI) return REFUSED_TO_ASKI[name]!;
  if (name === "t3_thread_organize")
    return field(params, "action") === "archive"
      ? "Aski's chat archives nothing. The person archives a Cell with their own hand, in the app: tell them so."
      : null;
  if (name === "t3_workflow")
    return WORKFLOW_READS.has(String(field(params, "action"))) ? null : STARTS_NOTHING;
  if (name === "schedule_task") {
    const elsewhere = field(params, "projectId");
    const reminder =
      field(params, "scheduledTaskId") === undefined &&
      field(params, "bindToCurrentThread") !== false &&
      field(params, "freshSession") !== true &&
      (elsewhere === undefined || elsewhere === projectId);
    return reminder ? null : ONLY_A_REMINDER;
  }
  return null;
};

/** A chain of helpers longer than this is taken for Aski's: nothing real hands work down so far. */
const MOST_HOPS = 8;

const unreadable = () =>
  new OrchestratorMcpFailure({
    code: "orchestration_error",
    message: "The operation could not be completed.",
  });

/**
 * Whose hand calls: Aski's when the calling chat runs on Aski's instance or descends from one
 * that does. A helper started with `delegate_task` runs on another instance and still acts on
 * what Aski read.
 */
const callerOf = Effect.fnUntraced(
  function* (thread: McpInvocationContext.McpThreadCaller) {
    const threads = filed;
    if (threads === null)
      return { askis: thread.providerInstanceId === ASKI_INSTANCE_ID, projectId: null };
    let shell = yield* threads.getThreadShell(thread.threadId);
    const projectId: string | null = shell?.projectId ?? null;
    if (thread.providerInstanceId === ASKI_INSTANCE_ID) return { askis: true, projectId };
    for (let hop = 0; shell !== null; hop++) {
      if (shell.providerInstanceId === ASKI_INSTANCE_ID || hop === MOST_HOPS)
        return { askis: true, projectId };
      const parent = shell.lineage.parentThreadId;
      if (parent === null) break;
      shell = yield* threads.getThreadShell(parent);
    }
    return { askis: false, projectId };
  },
  // Who calls can't be read: nothing guarded runs.
  Effect.mapError(unreadable),
);

/** `handlers` with the refusals in front; a call from no agent's chat passes as it is. */
export function guardAskisTools<Handlers extends Record<string, unknown>>(handlers: Handlers): Handlers {
  const guarded: Record<string, unknown> = { ...handlers };
  for (const [name, handler] of Object.entries(handlers)) {
    if (!(name in REFUSED_TO_ASKI) && !READ_BY_ARGUMENT.has(name)) continue;
    const run = handler as (params: unknown) => Effect.Effect<unknown, unknown, unknown>;
    guarded[name] = (params: unknown) =>
      Effect.gen(function* () {
        const scope = yield* McpInvocationContext.McpInvocationContext;
        if (scope.thread === undefined) return yield* run(params);
        const caller = yield* callerOf(scope.thread);
        const refusal = caller.askis
          ? refusedToAski(name, params, caller.projectId)
          : filed === null
            ? null
            : (REFUSED_TO_AGENTS[name] ?? null);
        if (refusal === null) return yield* run(params);
        return yield* new OrchestratorMcpFailure({ code: "capability_denied", message: refusal });
      });
  }
  return guarded as Handlers;
}
