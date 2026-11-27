import { expect, it } from "@effect/vitest";
import {
  EnvironmentId,
  EventId,
  MessageId,
  NodeId,
  type OrchestrationV2DomainEvent,
  ProviderInstanceId,
  RunId,
  ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { McpSchema, McpServer } from "effect/ai";

import type { RecallCard } from "../../../../../stemcells/recall/card.ts";
import * as McpHttpServer from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccessTestkit from "../../mcp/McpToolAccess.testkit.ts";
import * as Recall from "../recall/Recall.ts";
import { changesCard } from "./recall.ts";
import { registerRecallTool } from "./recallTool.ts";

// Contract: a chat reaches `stemcells_recall` through upstream's MCP server, registered as
// upstream registers its toolkits and behind its check that the caller is a live thread; who
// calls is read from upstream's invocation scope, and a Cell's project from its thread's shell.

const callerOf = (instance: string, subagent = false) => ({
  environmentId: EnvironmentId.make("environment-recall-test"),
  requestNamespace: "provider-session-recall-test",
  thread: {
    threadId: ThreadId.make("thread-caller"),
    providerSessionId: "provider-session-recall-test",
    providerInstanceId: ProviderInstanceId.make(instance),
    ...(subagent ? { subagent: true } : {}),
  },
  client: undefined,
  capabilities: new Set<never>(),
  issuedAt: 1,
});
const client = McpSchema.McpServerClient.of({
  clientId: 1,
  clientCapabilities: {},
  clientInfo: { name: "recall-test", version: "1.0.0" },
  protocolVersion: "2025-06-18",
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "recall-test", version: "1.0.0" },
  },
  getClient: Effect.die("unused"),
});

const film: RecallCard = {
  threadId: "thread-film",
  environmentId: "environment-recall-test",
  projectId: "project-harbor",
  project: "Harbor",
  title: "Film detail page",
  asked: ["Build the film detail page", "Also add the release year"],
  line: "film detail page shipped",
  verdict: "shown",
  proof: "pr-merged",
  changed: { files: 2, additions: 160, deletions: 8 },
  checks: [{ kind: "test", ok: true }],
  pullRequest: {
    number: 281,
    url: "https://example.com/acme/harbor/pull/281",
    state: "merged",
    draft: false,
    checks: "passing",
  },
  model: "gpt-5.4",
  bornAt: "2026-11-25T10:00:00.000Z",
  // Midday in UTC: the same day on nearly every calendar.
  landedAt: "2026-11-25T12:00:00.000Z",
  awake: false,
  flying: false,
  link: "[Film detail page](t3-thread://v2/environment-recall-test/thread-film)",
};

/** Every search the tool made. */
const searches: Recall.RecallQuery[] = [];

const room = registerRecallTool(McpHttpServer.toolkitRegistration).pipe(
  Layer.provideMerge(McpHttpServer.layerInProcessMcpServer),
  // Every thread's shell here is in the project `project:mcp-test`.
  Layer.provideMerge(McpToolAccessTestkit.liveThreadsLayer),
  Layer.provide(
    Layer.mock(Recall.Recall)({
      search: (query) =>
        Effect.sync(() => {
          searches.push(query);
          return {
            cards: [film],
            more: 2,
            read: {
              from: null,
              to: null,
              project: { id: "project-harbor", title: "Harbor" },
              words: ["film", "page"],
              widened: false,
            },
          };
        }),
    }),
  ),
);

const call = (instance: string, args: Record<string, unknown>, subagent = false) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    return yield* server
      .callTool({ name: "stemcells_recall", arguments: args })
      .pipe(
        Effect.provideService(
          McpInvocationContext.McpInvocationContext,
          callerOf(instance, subagent),
        ),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
  });

it.effect("Aski recalls across every project; a Cell its own repository alone", () =>
  Effect.gen(function* () {
    const aski = yield* call("aski", { query: "the film page in harbour" });
    expect(aski.isError).toBe(false);
    expect(aski.structuredContent).toEqual({
      found: 1,
      more: 2,
      report: [
        "1 Cell matched (words: film page · project: Harbor), and 2 more not shown:",
        "[Film detail page](t3-thread://v2/environment-recall-test/thread-film) · Harbor · asleep · 2026-11-25",
        "  asked: Build the film detail page",
        "  asked last: Also add the release year",
        "  came of it: film detail page shipped · shown: its pull request merged · +160 −8 in 2 files · tests clean · #281 merged",
      ].join("\n"),
    });
    yield* call("codex", { query: "the film page", state: "asleep", limit: 3 });
    // A Subcell of Aski's is a Cell like any.
    yield* call("aski", { query: "the film page" }, true);
    expect(searches.map((search) => [search.scope, search.state, search.limit])).toEqual([
      ["all", "both", 12],
      [{ projectId: "project:mcp-test" }, "asleep", 3],
      [{ projectId: "project:mcp-test" }, "both", 12],
    ]);
  }).pipe(Effect.provide(room)),
);

it("a card can differ after a run is asked for or ends, never after a Cell's own streaming", () => {
  const AT = DateTime.makeUnsafe("2026-11-25T10:00:00.000Z");
  const threadId = ThreadId.make("thread-film");
  const run = (status: "running" | "completed", type: "run.created" | "run.updated") =>
    ({
      id: EventId.make(`event:${type}:${status}`),
      type,
      threadId,
      occurredAt: AT,
      payload: {
        id: RunId.make("run-1"),
        threadId,
        ordinal: 1,
        providerInstanceId: ProviderInstanceId.make("codex"),
        modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
        providerThreadId: null,
        userMessageId: MessageId.make("message-ask"),
        rootNodeId: NodeId.make("node-1"),
        activeAttemptId: null,
        status,
        requestedAt: AT,
        startedAt: AT,
        completedAt: status === "completed" ? AT : null,
        checkpointId: null,
        contextHandoffId: null,
      },
    }) satisfies OrchestrationV2DomainEvent;
  const streamed: OrchestrationV2DomainEvent = {
    id: EventId.make("event:reply"),
    type: "message.updated",
    threadId,
    occurredAt: AT,
    payload: {
      createdBy: "agent",
      creationSource: "provider",
      id: MessageId.make("message-reply"),
      threadId,
      runId: RunId.make("run-1"),
      nodeId: NodeId.make("node-1"),
      role: "assistant",
      text: "Working on it",
      attachments: [],
      streaming: true,
      createdAt: AT,
      updatedAt: AT,
    },
  };
  expect(
    [
      run("running", "run.created"),
      run("running", "run.updated"),
      run("completed", "run.updated"),
      streamed,
    ].map(changesCard),
  ).toEqual([true, false, true, false]);
});
