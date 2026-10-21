import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import {
  HOUR,
  MINUTE,
  NOW,
  at,
  instanceId,
  pendingRequest,
  runId,
  shellFixture,
  threadId,
} from "../upstream/needs.fixture.ts";
import { ASKI_INSTANCE_ID, needOf, planOutline, signalOf } from "./derive.ts";

const kindOf = (...args: Parameters<typeof shellFixture>) =>
  signalOf(shellFixture(...args), NOW)?.kind ?? null;

const limited = {
  status: "failed",
  lastErrorClass: "usage_limit",
  usageLimitResetAt: "2026-10-27T09:00:00.000Z",
} as const;

describe("what needs the person, from a Cell's shell", () => {
  it("a pending request makes the card, keyed by the request, whatever else the Cell shows", () => {
    const signal = signalOf(
      shellFixture({
        ...limited,
        hasActionableProposedPlan: true,
        interactionMode: "plan",
        pendingRuntimeRequest: pendingRequest("command", { id: "request-7", ago: 3 * MINUTE }),
      }),
      NOW,
    );
    expect(signal).toMatchObject({ kind: "permission", key: "thread-floof:request:request-7" });
    expect(signal?.since).toBe(NOW - 3 * MINUTE);
  });

  it("names each request kind for the card it makes", () => {
    const kinds = {
      command: "permission",
      "file-read": "permission",
      "file-change": "permission",
      permission: "permission",
      user_input: "question",
      auth_refresh: "sign-in",
      "mcp-elicitation": "input",
      dynamic_tool_call: "input",
    } as const;
    for (const [request, kind] of Object.entries(kinds)) {
      expect(kindOf({ pendingRuntimeRequest: pendingRequest(request as keyof typeof kinds) })).toBe(
        kind,
      );
    }
  });

  it("blocks only when a running turn waits on the answer", () => {
    const blocking = signalOf(
      shellFixture({ pendingRuntimeRequest: pendingRequest("user_input") }),
      NOW,
    );
    const async = signalOf(
      shellFixture({ pendingRuntimeRequest: pendingRequest("user_input", { blocking: false }) }),
      NOW,
    );
    expect(blocking?.blocks).toBe(true);
    expect(async?.blocks).toBe(false);
  });

  it("never makes a card for Aski's own chat, an archived or a deleted Cell", () => {
    const asking = { pendingRuntimeRequest: pendingRequest("command") };
    expect(kindOf({ ...asking, providerInstanceId: instanceId(ASKI_INSTANCE_ID) })).toBeNull();
    expect(kindOf({ ...asking, archivedAt: at(-MINUTE) })).toBeNull();
    expect(kindOf({ ...asking, deletedAt: at(-MINUTE) })).toBeNull();
  });

  it("holds a snoozed Cell back until its time, unless it asks or fails after the snooze", () => {
    const snoozed = { snoozedUntil: at(HOUR), snoozedAt: at(-5 * MINUTE) };
    const failed = { status: "failed", lastErrorClass: "transport_error" } as const;
    expect(kindOf({ ...snoozed, ...failed, latestRunCompletedAt: at(-10 * MINUTE) })).toBeNull();
    expect(kindOf({ ...snoozed, ...failed, latestRunCompletedAt: at(-MINUTE) })).toBe("failed");
    expect(kindOf({ ...snoozed, pendingRuntimeRequest: pendingRequest("command") })).toBe(
      "permission",
    );
    expect(kindOf({ ...failed, snoozedUntil: at(-MINUTE), snoozedAt: at(-HOUR) })).toBe("failed");
  });

  it("shows a limit until T3 will carry the Cell on at a reset within 5 hours", () => {
    expect(kindOf(limited)).toBe("limit");
    const recovery = (resetIn: number, run = "run-1") => ({
      ...limited,
      limitRecovery: {
        runId: runId(run),
        resetAt: DateTime.formatIso(at(resetIn)),
        autoResume: true,
      },
    });
    expect(kindOf(recovery(2 * HOUR))).toBeNull();
    expect(kindOf(recovery(8 * HOUR))).toBe("limit");
    expect(kindOf(recovery(2 * HOUR, "run-0"))).toBe("limit");
    // The reset passed and the run never went on: the carry-on failed.
    expect(kindOf(recovery(-20 * MINUTE))).toBe("limit");
  });

  it("shows a failure only until the person has opened the Cell since it ended", () => {
    const failed = { status: "failed", lastErrorClass: "provider_error" } as const;
    expect(kindOf(failed)).toBe("failed");
    expect(kindOf({ ...failed, lastVisitedAt: at(-MINUTE) })).toBeNull();
    expect(kindOf({ ...failed, lastVisitedAt: at(-HOUR) })).toBe("failed");
  });

  it("shows a plan once the planning run has settled", () => {
    const plan = { hasActionableProposedPlan: true, interactionMode: "plan" } as const;
    expect(kindOf(plan)).toBe("plan");
    expect(kindOf({ ...plan, status: "running", activeRunId: runId("run-1") })).toBeNull();
    expect(kindOf({ ...plan, interactionMode: "default" })).toBeNull();
  });

  it("makes no card for a finished report or a working Cell", () => {
    expect(kindOf()).toBeNull();
    expect(kindOf({ status: "running", activeRunId: runId("run-1") })).toBeNull();
  });

  it("keeps a structured ask on a settled Cell: settling hides only what was read from prose", () => {
    expect(
      kindOf({ settledAt: at(-MINUTE), pendingRuntimeRequest: pendingRequest("command") }),
    ).toBe("permission");
  });
});

describe("a plan's outline", () => {
  it("is its heading and first three top-level steps, as written", () => {
    const outline = planOutline(
      [
        "# Move the header to tokens",
        "",
        "Some context first.",
        "1. Read the header's colours",
        "   - nested detail",
        "2. Map each to a token",
        "- [ ] Swap them in",
        "4. Check both skins",
      ].join("\n"),
    );
    expect(outline).toEqual({
      title: "Move the header to tokens",
      steps: ["Read the header's colours", "Map each to a token", "Swap them in"],
    });
  });

  it("has no title when the plan has no heading", () => {
    expect(planOutline("1. Only a step").title).toBeNull();
  });
});

describe("a card's data", () => {
  it("carries the request whole, and still names it when it couldn't be read", () => {
    const shell = shellFixture({
      pendingRuntimeRequest: pendingRequest("command", { id: "request-2" }),
      lineage: {
        rootThreadId: threadId("thread-parent"),
        parentThreadId: threadId("thread-parent"),
        relationshipToParent: "subagent",
      },
    });
    const signal = signalOf(shell, NOW);
    if (signal === null) throw new Error("expected a signal");
    const command = "git push --force-with-lease origin header-tokens";
    const read = needOf(
      signal,
      {
        request: {
          id: "request-2",
          prompt: command,
          appName: null,
          options: [{ decision: "accept", label: "Allow once" }],
          questions: [],
          responseMode: null,
          capability: "live",
        },
      },
      2,
    );
    expect(read).toMatchObject({
      number: 2,
      kind: "permission",
      parentThreadId: "thread-parent",
      blocks: true,
      request: { id: "request-2", kind: "command", prompt: command, capability: "live" },
    });
    expect(read.request?.options).toHaveLength(1);
    expect(needOf(signal, { request: null }, 2).request).toEqual({
      id: "request-2",
      kind: "command",
      prompt: null,
      appName: null,
      options: [],
      questions: [],
      responseMode: null,
      capability: null,
    });
  });

  it("gives a limit its reset and a failure its words", () => {
    const limit = signalOf(shellFixture(limited), NOW);
    const failure = signalOf(
      shellFixture({
        status: "failed",
        lastErrorClass: "transport_error",
        lastError: "socket closed",
      }),
      NOW,
    );
    if (limit === null || failure === null) throw new Error("expected signals");
    expect(needOf(limit, {}, 1).limit).toEqual({
      runId: "run-1",
      resetAt: "2026-10-27T09:00:00.000Z",
      autoResume: false,
    });
    expect(needOf(failure, {}, 1).failure).toEqual({
      runId: "run-1",
      errorClass: "transport_error",
      message: "socket closed",
    });
  });
});
