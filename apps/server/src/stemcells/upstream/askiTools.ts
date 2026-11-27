// @effect-diagnostics anyUnknownInErrorContext:off - every toolkit's handlers pass through the guard, each with channels of its own.
/**
 * What Aski's chat can do (stemcells/tasks/aski-orchestrator.md, decision 7). Aski reads what
 * Cells and web pages wrote, so its chat and any helper it hands a task to may call only the
 * tools listed here, in every mode; a tool a sync adds is refused until someone lists it.
 */
import { OrchestratorMcpFailure, ThreadId } from "@t3tools/contracts";
import { HTML_RENDER_TOOL_NAME } from "@t3tools/shared/htmlRender";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SHOW_TOOL } from "../../../../../stemcells/aski/show.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import { TOOL_SEARCH } from "../../mcp/McpToolExposure.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";
import { saidByThePerson } from "../aski/ownWords.ts";
import { isThePersons } from "./readScope.ts";

const STARTS_NOTHING =
  "Aski's chat starts no Cell by itself. Propose it with stemcells_propose: the person starts it with a tap.";
const MAKES_NOTHING =
  "Aski's chat makes no project. Tell the person to ask for it in their own words (\"a new project called …\"): Stemcells makes it once they confirm.";
const DELETES_NOTHING =
  "Aski's chat deletes nothing. The person deletes it with their own hand, in the app: tell them so.";
const ONLY_A_REMINDER =
  "Aski's chat schedules only a new reminder that comes back to this chat: schedule_task(prompt, schedule), nothing else set. The person changes a schedule in Settings.";
const ONLY_THEIR_WORDS =
  "Aski's chat sends a Cell only the person's own words: copy them from their message as they wrote them, in order, leaving out only what names the Cell. Add nothing, and keep every \"not\".";
const ONLY_READS = "Aski's chat only reads here: the person answers or changes it in that Cell's chat.";
const NOT_ASKIS = (name: string) =>
  `Aski's chat doesn't call ${name}. It reads, shows, proposes Cells (stemcells_propose) and passes on the person's own words; a Cell does the rest.`;

/** What Aski is told for the tools it reaches for most, in place of the plain refusal. */
const REFUSED_TO_ASKI: Readonly<Record<string, string>> = {
  t3_thread_launch: STARTS_NOTHING,
  create_threads: STARTS_NOTHING,
  run_scheduled_task_now: STARTS_NOTHING,
  t3_thread_transfer: STARTS_NOTHING,
  t3_project_create: MAKES_NOTHING,
  t3_project_clone: "Aski's chat makes no project. The person adds one from the app.",
  t3_project_delete: DELETES_NOTHING,
  delete_scheduled_task: DELETES_NOTHING,
};

/**
 * What anyone may call the same way: reading, showing, waiting and Aski's own tools. A call to
 * one of these passes without asking who calls.
 */
export const OPEN_TO_ASKI: ReadonlySet<string> = new Set([
  "t3_project_list",
  "t3_project_read",
  "t3_thread_list",
  "t3_thread_read",
  "t3_thread_search",
  "t3_thread_wait",
  "t3_thread_interrupt",
  "t3_environment_read",
  "t3_environment_links",
  "t3_worktree_list",
  "t3_worktree_status",
  "t3_preview_list",
  "t3_theme_read",
  "list_scheduled_tasks",
  "list_issues",
  "read_issue",
  "list_thread_issues",
  "list_thread_pull_requests",
  "pull_request_list",
  "pull_request_read",
  "read_pull_request_guide",
  "ci_logs",
  "orchestrator_capabilities",
  "task_status",
  "task_cancel",
  "t3_background_wait",
  "t3_submit_output",
  "request_secret",
  "html_preview",
  HTML_RENDER_TOOL_NAME,
  TOOL_SEARCH,
  SHOW_TOOL,
  "stemcells_arcs",
  "stemcells_plan",
  "stemcells_propose",
  "stemcells_recall",
  "stemcells_settings",
  "stemcells_standing",
  "stemcells_disk_report",
  "stemcells_disk_moves",
]);

/** What Aski may call one way and not another: `refusedToAski` reads what each is called with. */
export const RULED_FOR_ASKI: ReadonlySet<string> = new Set([
  "t3_thread_organize",
  "t3_workflow",
  "t3_pending_request",
  "delegate_task",
  "schedule_task",
  "t3_thread_send",
]);

/** What Aski may do to a Cell's place in the lists: all of it comes back. Archiving doesn't. */
const ORGANIZES = new Set(["pin", "unpin", "snooze", "unsnooze", "settle", "unsettle", "mark_unread"]);
/** What a workflow call may do from Aski's chat: read. Starting a run starts agents. */
const WORKFLOW_READS = new Set(["list", "read", "questions", "store", "hooks"]);
const QUESTION_READS = new Set(["list", "read"]);
/** How many of the person's latest messages in Aski's chat a send may copy from. */
const LATEST = 5;

/**
 * What no agent does, Aski or a Cell: a project leaves the app only by the person's own hand.
 * A Cell told to delete one, in the person's words or in words that only look like theirs,
 * says so instead.
 */
const REFUSED_TO_AGENTS: Readonly<Record<string, string>> = {
  t3_project_delete:
    "No Cell deletes a project. The person deletes one with their own hand, in the app: tell them so.",
};

type Threads = Pick<
  ThreadManagementService.ThreadManagementService["Service"],
  "getThreadShell" | "getThreadRecords"
>;

let filed: Threads | null = null;

/**
 * While this scope is open, the refusals to every agent stand, a helper is known by the chat
 * it descends from, and what Aski sends is held against what the person wrote.
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

/** A chain of helpers longer than this is taken for Aski's: nothing real hands work down so far. */
const MOST_HOPS = 8;

const unreadable = () =>
  new OrchestratorMcpFailure({
    code: "orchestration_error",
    message: "The operation could not be completed.",
  });

/**
 * Whether chat `threadId` is Aski's hand: it runs on Aski's instance or descends from a chat
 * that does. A helper started with `delegate_task` runs on another instance and still acts on
 * what Aski read. A line that can't be followed to its top is taken for Aski's.
 */
const isAskis = Effect.fnUntraced(function* (threads: Threads, threadId: ThreadId) {
  let shell = yield* threads.getThreadShell(threadId);
  for (let hop = 0; shell !== null; hop++) {
    if (shell.providerInstanceId === ASKI_INSTANCE_ID || hop === MOST_HOPS) return true;
    const parent = shell.lineage.parentThreadId;
    if (parent === null) return false;
    shell = yield* threads.getThreadShell(parent);
    if (shell === null) return true;
  }
  return false;
});

interface Caller {
  readonly thread: McpInvocationContext.McpThreadCaller;
  readonly environmentId: string;
}

/**
 * A message from Aski to a Cell: among Aski's own chats and helpers it says what it likes; to
 * anyone else, only Aski's own chat sends, and only words the person wrote there themselves.
 */
const sendRefused = Effect.fnUntraced(function* (caller: Caller, params: unknown) {
  const threads = filed;
  const target = field(params, "threadId");
  const message = field(params, "message");
  if (threads === null || typeof target !== "string" || typeof message !== "string")
    return ONLY_THEIR_WORDS;
  const elsewhere = field(params, "environmentId");
  const here = elsewhere === undefined || elsewhere === caller.environmentId;
  if (here && (yield* isAskis(threads, ThreadId.make(target)))) return null;
  // A Cell keeps what it knows: starting it over is the person's to do.
  if (field(params, "freshContext") === true) return ONLY_THEIR_WORDS;
  const own = yield* threads.getThreadShell(caller.thread.threadId);
  // A helper has no words of the person's to pass on.
  if (own === null || own.lineage.parentThreadId !== null) return ONLY_THEIR_WORDS;
  const { messages } = yield* threads.getThreadRecords(caller.thread.threadId, ["messages"], {
    messageRoles: ["user"],
  });
  const theirs = messages.filter(isThePersons).slice(-LATEST);
  return saidByThePerson(
    message,
    theirs.map((one) => one.text),
  )
    ? null
    : ONLY_THEIR_WORDS;
});

/** Why Aski's hand may not make this call, or null when it may. */
const refusedToAski = Effect.fnUntraced(function* (name: string, params: unknown, caller: Caller) {
  switch (name) {
    case "t3_thread_organize":
      return ORGANIZES.has(String(field(params, "action")))
        ? null
        : "Aski's chat archives nothing. The person archives a Cell with their own hand, in the app: tell them so.";
    case "t3_workflow":
      return WORKFLOW_READS.has(String(field(params, "action"))) ? null : STARTS_NOTHING;
    case "t3_pending_request":
      return QUESTION_READS.has(String(field(params, "action"))) ? null : ONLY_READS;
    case "delegate_task": {
      // A helper on another machine is a stranger there: that machine's guard can't know it.
      const target = field(params, "target");
      const where = field(typeof target === "string" ? safeJson(target) : target, "environmentId");
      return where === undefined || where === caller.environmentId
        ? null
        : "Aski's helpers run on this machine. Leave target.environmentId out.";
    }
    case "schedule_task": {
      // A schedule is a Cell on a timer, but for a reminder that comes back to Aski's own
      // chat, where these refusals meet it again.
      const own = filed === null ? null : yield* filed.getThreadShell(caller.thread.threadId);
      const elsewhere = field(params, "projectId");
      const reminder =
        field(params, "scheduledTaskId") === undefined &&
        field(params, "environmentId") === undefined &&
        field(params, "bindToCurrentThread") !== false &&
        field(params, "freshSession") !== true &&
        (elsewhere === undefined || elsewhere === own?.projectId);
      return reminder ? null : ONLY_A_REMINDER;
    }
    case "t3_thread_send":
      return yield* sendRefused(caller, params);
    default:
      return REFUSED_TO_ASKI[name] ?? NOT_ASKIS(name);
  }
});

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Why this call is refused, or null. Who calls can't be read: nothing guarded runs. */
const refusalOf = Effect.fnUntraced(
  function* (name: string, params: unknown, caller: Caller) {
    const askis =
      caller.thread.providerInstanceId === ASKI_INSTANCE_ID ||
      (filed !== null && (yield* isAskis(filed, caller.thread.threadId)));
    if (askis) return yield* refusedToAski(name, params, caller);
    return filed === null ? null : (REFUSED_TO_AGENTS[name] ?? null);
  },
  Effect.mapError(unreadable),
);

/** `handlers` with the refusals in front; a call from no agent's chat passes as it is. */
export function guardAskisTools<Handlers extends Record<string, unknown>>(handlers: Handlers): Handlers {
  const guarded: Record<string, unknown> = { ...handlers };
  for (const [name, handler] of Object.entries(handlers)) {
    if (OPEN_TO_ASKI.has(name)) continue;
    const run = handler as (params: unknown) => Effect.Effect<unknown, unknown, unknown>;
    guarded[name] = (params: unknown) =>
      Effect.gen(function* () {
        const scope = yield* McpInvocationContext.McpInvocationContext;
        if (scope.thread === undefined) return yield* run(params);
        const refusal = yield* refusalOf(name, params, {
          thread: scope.thread,
          environmentId: scope.environmentId,
        });
        if (refusal === null) return yield* run(params);
        return yield* new OrchestratorMcpFailure({ code: "capability_denied", message: refusal });
      });
  }
  return guarded as Handlers;
}
