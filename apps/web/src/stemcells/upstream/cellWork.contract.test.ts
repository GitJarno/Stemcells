/**
 * What a Cell's acting relies on in upstream: the turn items a run's tool
 * calls become, the run a shell names, the desktop keeping running threads
 * live, and the prompt cache's expiry Claude's turns carry. A failure here after a sync names the contract that moved;
 * the fix goes in `cellWork.ts`, not in the views.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  OrchestrationV2TurnItem,
  type OrchestrationV2ProviderTurn,
  type OrchestrationV2ThreadProjection,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";

import rootSource from "../../routes/__root.tsx?raw";
import claudeAdapterSource from "../../../../server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts?raw";
import { currentActivity } from "../cell/activity";
import { beatOf, beatsOf, CODEX_CACHE_MS, coldAtFor, coldAtOf, newsOf } from "./cellWork";

const decode = Schema.decodeUnknownSync(OrchestrationV2TurnItem);
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
