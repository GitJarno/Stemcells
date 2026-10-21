/**
 * What a Cell's acting relies on in upstream: the turn items a run's tool
 * calls become, the run a shell names, the desktop keeping running threads
 * live, the prompt cache's expiry Claude's turns carry, and the runs and
 * requests its growth is read from. A failure here after a sync names the
 * contract that moved; the fix goes in `cellWork.ts`, not in the views.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  OrchestrationV2ExecutionNode,
  OrchestrationV2PendingBackgroundTask,
  OrchestrationV2Run,
  OrchestrationV2RuntimeRequest,
  OrchestrationV2TurnItem,
  type OrchestrationV2ProviderTurn,
  type OrchestrationV2ThreadProjection,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";

import rootSource from "../../routes/__root.tsx?raw";
import claudeAdapterSource from "../../../../server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts?raw";
import projectionStoreSource from "../../../../server/src/orchestration-v2/ProjectionStore.ts?raw";
import { budsOf, currentActivity } from "../cell/activity";
import {
  beatOf,
  beatsOf,
  CODEX_CACHE_MS,
  coldAtFor,
  coldAtOf,
  growthOf,
  newsOf,
  subagentsAwayOf,
} from "./cellWork";

const decode = Schema.decodeUnknownSync(OrchestrationV2TurnItem);
const decodePending = Schema.decodeUnknownSync(Schema.Array(OrchestrationV2PendingBackgroundTask));
const at = DateTime.makeUnsafe("2026-10-21T08:00:00.000Z");

/** A turn item as the wire carries it: a call of `type` in run `run-1`, `status`. */
function item(type: string, fields: Record<string, unknown>, status = "running") {
  return decode({
    id: `item-${type}`,
    threadId: "thread-1",
    runId: "run-1",
    nodeId: null,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    parentItemId: null,
    ordinal: 1,
    status,
    title: null,
    startedAt: at,
    completedAt: null,
    updatedAt: at,
    type,
    ...fields,
  });
}

/** What a subagent item carries beside the common fields: Claude's Task, as its adapter reports it. */
const subagent = {
  subagentId: "node-subagent",
  origin: "provider_native",
  driver: "claudeAgent",
  providerInstanceId: "claudeAgent",
  childThreadId: null,
  prompt: "Find where the gate stalls",
  result: null,
};

const acting = (type: string, fields: Record<string, unknown>) => {
  const beat = beatOf(item(type, fields));
  return currentActivity(true, beat === undefined ? [] : [beat]);
};

describe("what a working Cell acts out, from its run's turn items", () => {
  it("names each call the way the original's classifier reads tools", () => {
    expect(acting("command_execution", { input: "pnpm exec vp test run" })).toBe("testing");
    expect(acting("command_execution", { input: "git push" })).toBe("shipping");
    expect(acting("command_execution", { input: "/bin/zsh -lc 'sleep 12'" })).toBe("waiting");
    expect(acting("command_execution", { input: 'bash -lc "pnpm test"' })).toBe("testing");
    expect(acting("dynamic_tool", { toolName: "Read", input: { file_path: "a.ts" } })).toBe(
      "reading",
    );
    expect(acting("dynamic_tool", { toolName: "Grep", input: { pattern: "x" } })).toBe("searching");
    expect(acting("file_search", { pattern: "*.ts" })).toBe("searching");
    expect(acting("web_search", { patterns: ["kit"] })).toBe("browsing");
    expect(acting("file_change", { fileName: "a.ts" })).toBe("editing");
    expect(acting("reasoning", { text: "hm", streaming: true })).toBe("thinking");
    expect(acting("subagent", subagent)).toBe("delegating");
  });

  it("stands a bud beside the Cell for each subagent still at work", () => {
    const running = projected(item("subagent", subagent));
    const done = projected(item("subagent", subagent, "completed"));
    expect(budsOf(beatsOf([running, done], "run-1"))).toBe(1);
  });

  it("thinks again once its call has returned, and reads only the run in progress", () => {
    const done = item("command_execution", { input: "make build" }, "completed");
    expect(currentActivity(true, beatsOf([projected(done)], "run-1"))).toBe("thinking");
    const running = item("command_execution", { input: "make build" });
    expect(currentActivity(true, beatsOf([projected(running)], "run-1"))).toBe("building");
    expect(beatsOf([projected(running)], "run-2")).toEqual([]);
  });

  it("Claude's tools arrive as the item types it reads, its own tools by name", () => {
    for (const line of [
      'bash: { itemType: "command_execution"',
      'read: { itemType: "dynamic_tool"',
      'grep: { itemType: "dynamic_tool"',
      'webfetch: { itemType: "web_search"',
      'edit: { itemType: "file_change"',
      "toolName: input.toolName,",
    ]) {
      expect(claudeAdapterSource).toContain(line);
    }
  });

  it("a shell names the run in progress and when the last one landed", () => {
    expectTypeOf<EnvironmentThreadShell>().toMatchTypeOf<{
      readonly runtime: { readonly activeRunId: string | null } | null;
      readonly latestRun: { readonly status: string; readonly completedAt: string | null } | null;
    }>();
  });

  it("a shell lists the subagents still at work once its turn is over", () => {
    expectTypeOf<EnvironmentThreadShell>().toMatchTypeOf<{
      readonly pendingBackgroundTasks?: ReadonlyArray<{ readonly kind: string }>;
    }>();
    const pending = decodePending([
      { taskId: "bg-1", kind: "subagent", childThreadId: "thread-child" },
      { taskId: "bg-2", kind: "monitor" },
      { taskId: "bg-3", kind: "subagent" },
    ]);
    expect(subagentsAwayOf(pending)).toBe(2);
    expect(subagentsAwayOf(undefined)).toBe(0);
  });

  it("the desktop app keeps every running thread's items live, seen or not", () => {
    expect(rootSource).toContain("{isElectron ? <RunningThreadKeepAlive /> : null}");
  });
});

describe("when a chat's prompt cache goes cold", () => {
  it("is Claude's as its turn says, Codex's half an hour on, and no other provider's", () => {
    const landed = 1_000_000;
    expect(coldAtFor("claudeAgent", landed, landed + 60 * 60_000)).toBe(landed + 60 * 60_000);
    expect(coldAtFor("claudeAgent", landed, undefined)).toBeUndefined();
    expect(coldAtFor("codex", landed, undefined)).toBe(landed + CODEX_CACHE_MS);
    expect(CODEX_CACHE_MS).toBe(30 * 60_000);
    expect(coldAtFor("opencode", landed, landed)).toBeUndefined();
    expect(coldAtFor(null, landed, landed)).toBeUndefined();
  });

  it("Claude's adapter stamps the expiry by the tier the request wrote, from the request's start", () => {
    for (const line of [
      "if (cacheCreation.ephemeral_1h_input_tokens > 0) return 60 * 60_000;",
      "if (cacheCreation.ephemeral_5m_input_tokens > 0) return 5 * 60_000;",
      ": DateTime.formatIso(DateTime.add(requestedAt, { milliseconds: promptCacheTtlMs }));",
      "if (requestStarted && context.streamUsage !== null) context.streamUsage.requestedAt = now;",
    ]) {
      expect(claudeAdapterSource).toContain(line);
    }
    type Usage = NonNullable<OrchestrationV2ProviderTurn["tokenUsage"]>;
    expectTypeOf<Usage["promptCacheExpiresAt"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Usage["updatedAt"]>().toEqualTypeOf<string>();
  });

  it("reads the newest turn's expiry once the detail has seen the run land", () => {
    const expiry = "2026-10-21T09:00:00.000Z";
    const thread = detail("completed", [
      usage("2026-10-21T07:00:00.000Z", "2026-10-21T07:05:00.000Z"),
      usage("2026-10-21T08:00:30.000Z", expiry),
    ]);
    expect(coldAtOf(thread, "run-1")).toBe(Date.parse(expiry));
    expect(coldAtOf(detail("running", []), "run-1")).toBeNull();
    expect(coldAtOf(thread, "run-2")).toBeNull();
  });

  it("makes no claim when the newest usage names no expiry", () => {
    const servedFromCache = detail("completed", [
      usage("2026-10-21T07:00:00.000Z", "2026-10-21T08:00:00.000Z"),
      usage("2026-10-21T08:00:30.000Z", undefined),
    ]);
    expect(coldAtOf(servedFromCache, "run-1")).toBeUndefined();
  });
});

/** A turn's usage reported at `updatedAt`, its cache expiring at `expiresAt`. */
function usage(updatedAt: string, expiresAt: string | undefined) {
  return {
    tokenUsage: {
      usedTokens: 1_000,
      updatedAt,
      ...(expiresAt === undefined ? {} : { promptCacheExpiresAt: expiresAt }),
    },
  };
}

/** A thread's detail with run `run-1` in `status` and its provider turns. */
function detail(
  status: string,
  providerTurns: ReadonlyArray<ReturnType<typeof usage>>,
): OrchestrationV2ThreadProjection {
  return {
    thread: { id: "thread-1", activeProviderThreadId: "provider-thread-1", forkedFrom: null },
    runs: [{ id: "run-1", status }],
    providerThreads: [{ id: "provider-thread-1", contextUsage: null }],
    providerTurns,
    contextTransfers: [],
  } as unknown as OrchestrationV2ThreadProjection;
}

function projected(turnItem: OrchestrationV2TurnItem) {
  return {
    position: 0,
    visibility: "local" as const,
    sourceThreadId: turnItem.threadId,
    sourceItemId: turnItem.id,
    item: turnItem,
  };
}

describe("what is news in a run: the original's silence before thought goes deep", () => {
  const reply = (text: string) =>
    projected(item("assistant_message", { messageId: "m-1", text, streaming: true }));

  it("turns with a new item, a word of the reply or thought, and a call's change", () => {
    const first = newsOf([projected(item("reasoning", { text: "hm", streaming: true }))], "run-1");
    const more = newsOf([projected(item("reasoning", { text: "hmm", streaming: true }))], "run-1");
    expect(more.key).not.toBe(first.key);
    expect(newsOf([reply("a"), reply("ab")], "run-1").key).not.toBe(
      newsOf([reply("a")], "run-1").key,
    );
    // A call's change stamps the item anew.
    const running = item("command_execution", { input: "make" });
    const done = {
      ...item("command_execution", { input: "make" }, "completed"),
      updatedAt: DateTime.makeUnsafe("2026-10-21T08:00:05.000Z"),
    };
    expect(newsOf([projected(done)], "run-1").key).not.toBe(
      newsOf([projected(running)], "run-1").key,
    );
  });

  it("reads only the run in progress, and says while a compaction runs", () => {
    const other = projected(item("reasoning", { text: "hm", streaming: true }));
    expect(newsOf([other], "run-2").key).toBe(newsOf([], "run-2").key);
    expect(newsOf([projected(item("compaction", { driver: null }))], "run-1").compacting).toBe(
      true,
    );
    expect(
      newsOf([projected(item("compaction", { driver: null }, "completed"))], "run-1").compacting,
    ).toBe(false);
  });
});

/** The fields growth reads, decoded by upstream's own schemas for them. */
const decodeRuns = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      id: OrchestrationV2Run.fields.id,
      status: OrchestrationV2Run.fields.status,
      startedAt: OrchestrationV2Run.fields.startedAt,
      completedAt: OrchestrationV2Run.fields.completedAt,
    }),
  ),
);
const decodeRequests = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      nodeId: OrchestrationV2RuntimeRequest.fields.nodeId,
      responseCapability: OrchestrationV2RuntimeRequest.fields.responseCapability,
      createdAt: OrchestrationV2RuntimeRequest.fields.createdAt,
      resolvedAt: OrchestrationV2RuntimeRequest.fields.resolvedAt,
    }),
  ),
);
const decodeNodes = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      id: OrchestrationV2ExecutionNode.fields.id,
      runId: OrchestrationV2ExecutionNode.fields.runId,
    }),
  ),
);

describe("how long a chat's Cell has worked alone, from its thread's detail", () => {
  const minutes = (n: number) => n * 60_000;
  const utc = (iso: string) => DateTime.makeUnsafe(iso);
  const live = { type: "live", providerSessionId: "session-1" };
  const thread = {
    runs: decodeRuns([
      // 40 min, 10 of them waiting on an approval: 30 alone.
      {
        id: "run-1",
        status: "completed",
        startedAt: utc("2026-10-21T08:00:00Z"),
        completedAt: utc("2026-10-21T08:40:00Z"),
      },
      // Stopped: it never landed.
      {
        id: "run-2",
        status: "interrupted",
        startedAt: utc("2026-10-21T09:00:00Z"),
        completedAt: utc("2026-10-21T10:00:00Z"),
      },
      {
        id: "run-3",
        status: "completed",
        startedAt: utc("2026-10-21T10:00:00Z"),
        completedAt: utc("2026-10-21T10:15:00Z"),
      },
      { id: "run-4", status: "running", startedAt: utc("2026-10-21T11:00:00Z"), completedAt: null },
    ]),
    runtimeRequests: decodeRequests([
      {
        nodeId: "node-approval",
        responseCapability: live,
        createdAt: utc("2026-10-21T08:10:00Z"),
        resolvedAt: utc("2026-10-21T08:20:00Z"),
      },
      // An async question the run worked on past: no wait.
      {
        nodeId: "node-question",
        responseCapability: { type: "message" },
        createdAt: utc("2026-10-21T08:30:00Z"),
        resolvedAt: utc("2026-10-21T08:35:00Z"),
      },
      {
        nodeId: "node-later",
        responseCapability: live,
        createdAt: utc("2026-10-21T11:05:00Z"),
        resolvedAt: null,
      },
    ]),
    nodes: decodeNodes([
      { id: "node-approval", runId: "run-1" },
      { id: "node-question", runId: "run-1" },
      { id: "node-later", runId: "run-4" },
    ]),
  };

  it("sums its landed runs, each less the time a blocking request held it", () => {
    expect(growthOf(thread, null)).toEqual({ alone: minutes(45), run: 0 });
    expect(growthOf(thread, "run-1")).toEqual({ alone: minutes(45), run: minutes(30) });
    expect(growthOf(thread, "run-3")).toEqual({ alone: minutes(45), run: minutes(15) });
  });

  it("waits until the detail has seen the run land", () => {
    expect(growthOf(thread, "run-4")).toBeNull();
    expect(growthOf(thread, "run-2")).toBeNull();
  });

  it("calls a request blocking by upstream's own test, as the shell's needs-you does", () => {
    expect(projectionStoreSource).toContain(
      'blocking: request.responseCapability.type !== "message",',
    );
  });
});
