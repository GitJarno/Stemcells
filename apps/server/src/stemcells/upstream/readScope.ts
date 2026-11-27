/**
 * A Cell's tools reach its own repository's chats (`readScope/rule.ts`). Upstream checks
 * that a caller is live, not which project it is in, so one gate stands where upstream
 * builds every toolkit's handlers (`McpToolAccess.routed`): a call that names a chat is
 * asked here before upstream's handler runs, and listing and searching answer for the
 * Cell's repository. Upstream hands that spot nothing that reaches the threads or the
 * projects, so the server layer files them here while it runs, as `peers/elsewhere.ts`
 * is filed. Upstream's toolkits built alone, as its suites build them, are upstream's.
 *
 * Not asked: a call to a linked environment (it is answered there), and tools that fail
 * with their own error type (issues, pull requests, worktrees), which read no chat.
 */
import {
  type EnvironmentId,
  type OrchestrationV2ConversationMessage,
  type OrchestrationV2ThreadShell,
  OrchestratorMcpFailure,
  ThreadId,
} from "@t3tools/contracts";
import { threadLinkRefs } from "@t3tools/shared/threadLinks";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { Tool } from "effect/ai";

import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import * as ProjectService from "../../project/ProjectService.ts";
import {
  allows,
  isAskisChat,
  NO_TIES,
  OTHER_PROJECT,
  reachOf,
  refusalOf,
  sameRepository,
  type ScopeThread,
} from "../readScope/rule.ts";
import { repoKeysOf } from "./peers.ts";

interface Filed {
  readonly threads: Pick<
    ThreadManagementService.ThreadManagementService["Service"],
    "getThreadShell" | "getThreadRecords"
  >;
  /** Each project's repository key, read per call: a project's remote can change. */
  readonly repos: Effect.Effect<ReadonlyMap<string, string>>;
}

let filed: Filed | null = null;

/** Files what the gate reads until the scope closes. */
export const fileReadScope = (reads: Filed) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      filed = reads;
    }),
    () =>
      Effect.sync(() => {
        if (filed === reads) filed = null;
      }),
  );

/** The gate asks for as long as Stemcells' server layer is up (`layer.ts`). */
export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const threads = yield* ThreadManagementService.ThreadManagementService;
    const projects = yield* ProjectService.ProjectService;
    yield* fileReadScope({ threads, repos: repoKeysOf(projects) });
  }),
);

const refused = (message: string) =>
  new OrchestratorMcpFailure({ code: "capability_denied", message });

const unreadable = () =>
  new OrchestratorMcpFailure({
    code: "orchestration_error",
    message: "The operation could not be completed.",
  });

const factsOf = (shell: OrchestrationV2ThreadShell, repos: ReadonlyMap<string, string>) =>
  ({
    id: shell.id,
    projectId: shell.projectId,
    repo: repos.get(shell.projectId) ?? null,
    providerInstanceId: shell.providerInstanceId,
    parentThreadId: shell.lineage.parentThreadId,
    rootThreadId: shell.lineage.rootThreadId,
  }) satisfies ScopeThread;

interface Cell {
  readonly reads: Filed;
  readonly caller: ScopeThread;
  readonly repos: ReadonlyMap<string, string>;
  readonly environmentId: EnvironmentId;
}

/**
 * The calling Cell, or null for a caller the scope doesn't bind: a client outside the app
 * (it has no thread), Aski's chat, and any caller while nothing is filed.
 */
const callingCell = Effect.fnUntraced(function* () {
  const reads = filed;
  if (reads === null) return null;
  const scope = yield* McpInvocationContext.McpInvocationContext;
  if (scope.thread === undefined) return null;
  const shell = yield* reads.threads
    .getThreadShell(scope.thread.threadId)
    .pipe(Effect.mapError(unreadable));
  if (shell === null || shell.deletedAt !== null) {
    return yield* new OrchestratorMcpFailure({
      code: "thread_not_found",
      message: "The calling thread was not found.",
    });
  }
  const repos = yield* reads.repos;
  const caller = factsOf(shell, repos);
  if (isAskisChat(caller)) return null;
  return { reads, caller, repos, environmentId: scope.environmentId } satisfies Cell;
});

/** A message the person wrote themselves: not another Cell's, a schedule's, a link's or a guest's. */
const isThePersons = (message: OrchestrationV2ConversationMessage) =>
  message.role === "user" &&
  message.createdBy === "user" &&
  message.senderThreadId === undefined &&
  message.linkedSender === undefined &&
  message.scheduledTaskId === undefined &&
  message.context?.guest === undefined;

/** Whether the message attaches the chat here: as a chip, or as a link in its text. */
const attaches = (
  message: OrchestrationV2ConversationMessage,
  threadId: string,
  environmentId: EnvironmentId,
) =>
  (message.context?.records ?? []).some(
    (record) =>
      record.kind === "thread" &&
      "threadId" in record &&
      record.threadId === threadId &&
      record.environmentId === environmentId,
  ) ||
  threadLinkRefs(message.text, environmentId).some(
    (ref) => ref.threadId === threadId && ref.environmentId === environmentId,
  );

const userMessagesOf = (cell: Cell, threadId: string) =>
  cell.reads.threads
    .getThreadRecords(ThreadId.make(threadId), ["messages"], { messageRoles: ["user"] })
    .pipe(
      Effect.map(({ messages }) => messages),
      Effect.mapError(unreadable),
    );

/**
 * What only the messages tell. Upstream gives a launched chat no parent: its first
 * message names the thread that sent it (`t3_thread_launch`), and a Cell can't send a
 * first message into another repository's chat any other way.
 */
const tiesOf = Effect.fnUntraced(function* (cell: Cell, target: ScopeThread) {
  const own = [...new Set([cell.caller.id, cell.caller.rootThreadId])];
  const first = (yield* userMessagesOf(cell, target.id)).reduce<
    OrchestrationV2ConversationMessage | undefined
  >(
    (earliest, message) =>
      earliest === undefined ||
      DateTime.toEpochMillis(message.createdAt) < DateTime.toEpochMillis(earliest.createdAt)
        ? message
        : earliest,
    undefined,
  );
  const launched =
    first?.createdBy === "agent" &&
    first.senderThreadId !== undefined &&
    own.includes(first.senderThreadId);
  if (launched) return { launched, attached: false };
  for (const threadId of own) {
    const messages = yield* userMessagesOf(cell, threadId);
    if (
      messages.some(
        (message) => isThePersons(message) && attaches(message, target.id, cell.environmentId),
      )
    ) {
      return { launched, attached: true };
    }
  }
  return NO_TIES;
});

/** Refuses a chat outside the Cell's reach. One upstream can't find is left for upstream to say so. */
const assertReach = Effect.fnUntraced(function* (cell: Cell, tool: string, threadId: string) {
  if (threadId === cell.caller.id) return;
  const shell = yield* cell.reads.threads
    .getThreadShell(ThreadId.make(threadId))
    .pipe(Effect.mapError(unreadable));
  if (shell === null || shell.deletedAt !== null) return;
  const target = factsOf(shell, cell.repos);
  const reach =
    reachOf(cell.caller, target, NO_TIES) ??
    reachOf(cell.caller, target, yield* tiesOf(cell, target));
  if (!allows(tool, reach)) return yield* refused(refusalOf(tool));
});

const inRepository = (cell: Cell, projectId: string) =>
  sameRepository(cell.caller, { projectId, repo: cell.repos.get(projectId) ?? null });

/** Whether the calling Cell may hear of a project's Cells; every project, for a caller the scope doesn't bind. */
export const projectsInReach = callingCell().pipe(
  Effect.map(
    (cell) => (projectId: string) => cell === null || inRepository(cell, projectId),
  ),
);

/** A parameter that names a chat: `threadId`, and `targetThreadId` (a merge back). */
const namesThread = (name: string) => /^(?:t|.+T)hreadId$/.test(name);

type Handler<E, R> = (params: Record<string, unknown>) => Effect.Effect<unknown, E, R>;

interface Listed {
  readonly currentThreadId: unknown;
  readonly threads: ReadonlyArray<unknown>;
  readonly total: number;
}

/** Upstream's default page, said here so the pages of several projects add up to one. */
const LIST_PAGE = 10;

/**
 * `allProjects` from a Cell is its repository: the Cell's project first, then the others
 * that are the same repository, as one list with one count. Each project is upstream's
 * own page, so nothing outside is read at all.
 */
const listRepository = Effect.fnUntraced(function* <E, R>(
  cell: Cell,
  handle: Handler<E, R>,
  { allProjects: _all, projectId: _named, ...rest }: Record<string, unknown>,
) {
  const cursor = typeof rest.cursor === "number" ? rest.cursor : 0;
  const limit = typeof rest.limit === "number" ? rest.limit : LIST_PAGE;
  const others = [...cell.repos.keys()]
    .filter((projectId) => projectId !== cell.caller.projectId && inRepository(cell, projectId))
    .toSorted();
  const threads: Array<unknown> = [];
  let skip = cursor;
  let total = 0;
  let currentThreadId: unknown = null;
  for (const projectId of [cell.caller.projectId, ...others]) {
    const room = limit - threads.length;
    // A full page still asks, for one row: the count is the whole repository's.
    const page = (yield* handle({
      ...rest,
      projectId,
      cursor: skip,
      limit: Math.max(room, 1),
    })) as Listed;
    threads.push(...page.threads.slice(0, room));
    skip = Math.max(0, skip - page.total);
    total += page.total;
    currentThreadId = page.currentThreadId;
  }
  return {
    projectId: null,
    currentThreadId,
    threads,
    nextCursor: cursor + limit < total ? cursor + limit : null,
    total,
  };
});

const gated = <E, R>(tool: string, handle: Handler<E, R>) =>
  Effect.fnUntraced(function* (params: Record<string, unknown>) {
    const named = Object.entries(params).flatMap(([name, value]) =>
      namesThread(name) && typeof value === "string" ? [value] : [],
    );
    const lists = tool === "t3_thread_list";
    const project = lists || tool === "t3_thread_search" ? params.projectId : undefined;
    if (named.length === 0 && !lists && project === undefined) return yield* handle(params);
    const cell = yield* callingCell();
    if (cell === null) return yield* handle(params);
    for (const threadId of named) yield* assertReach(cell, tool, threadId);
    if (lists && params.allProjects === true) return yield* listRepository(cell, handle, params);
    if (typeof project === "string" && !inRepository(cell, project)) {
      return yield* refused(OTHER_PROJECT);
    }
    return yield* handle(params);
  });

/**
 * Upstream's checked handlers, each behind the gate. A tool that fails with its own
 * error type can't say the refusal, so it stays as it is.
 */
export const scoped = <Handlers extends object>(
  toolkit: { readonly tools: Record<string, Tool.Any> },
  handlers: Handlers,
): Handlers =>
  Object.fromEntries(
    Object.entries(handlers).map(([name, handle]) => [
      name,
      toolkit.tools[name]?.failureSchema === OrchestratorMcpFailure
        ? gated(name, handle as Handler<OrchestratorMcpFailure, never>)
        : handle,
    ]),
  ) as Handlers;
