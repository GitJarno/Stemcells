/**
 * Upstream shapes Aski's needs list reads (stemcells/tasks/aski-room.md,
 * "What T3 gives us to build on"). A failure here after a sync names what
 * moved: a request kind with no card, a run status the list doesn't place,
 * or a shell field the fixtures no longer match.
 */
import {
  CommandId,
  EventId,
  OrchestrationV2ProviderFailureClass,
  OrchestrationV2RunStatus,
  OrchestrationV2RuntimeRequest,
  OrchestrationV2StoredEvent,
  OrchestrationV2ThreadShell,
  OrchestrationV2TurnItem,
  ProviderApprovalFullAccessOverride,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { REQUEST_KINDS } from "../needs/derive.ts";
import { byThread, settledByHandAt } from "./needs.ts";
import {
  HOUR,
  MINUTE,
  NOW,
  at,
  pendingRequest,
  runId,
  shellFixture,
  threadId,
} from "./needs.fixture.ts";

describe("upstream's thread shell, as the needs list reads it", () => {
  it("has a card for every kind of runtime request", () => {
    const upstream = OrchestrationV2RuntimeRequest.fields.kind.members.flatMap((member) => [
      ...member.literals,
    ]);
    expect(new Set(upstream)).toEqual(new Set(Object.keys(REQUEST_KINDS)));
  });

  it("knows every run status: the active five keep a plan back, the rest have ended", () => {
    expect(OrchestrationV2RunStatus.literals).toEqual([
      "preparing",
      "queued",
      "starting",
      "running",
      "waiting",
      "completed",
      "interrupted",
      "failed",
      "cancelled",
      "rolled_back",
    ]);
  });

  it("gives an approval the provider's reason and why full access still asks, as the cards say", () => {
    const approval = OrchestrationV2TurnItem.members.find(
      (member) => member.fields.type.literal === "approval_request",
    );
    expect(approval?.fields).toHaveProperty("reason");
    expect(approval?.fields).toHaveProperty("fullAccessOverride");
    // The web's wire names these two, each with its own words (needs/card.ts).
    expect(ProviderApprovalFullAccessOverride.literals).toEqual(["ask_rule", "provider_check"]);
  });

  it("still names a usage limit as its own failure class", () => {
    expect(OrchestrationV2ProviderFailureClass.literals).toContain("usage_limit");
  });

  it("is what the fixtures build: a shell asking, limited, snoozed and planning", () => {
    const shells = [
      shellFixture(),
      shellFixture({ pendingRuntimeRequest: pendingRequest("user_input", { blocking: false }) }),
      shellFixture({
        status: "failed",
        lastErrorClass: "usage_limit",
        usageLimitResetAt: DateTime.formatIso(at(HOUR)),
        limitRecovery: {
          runId: runId("run-1"),
          resetAt: DateTime.formatIso(at(HOUR)),
          autoResume: true,
        },
      }),
      shellFixture({ snoozedUntil: at(HOUR), snoozedAt: at(-HOUR), lastVisitedAt: at(-HOUR) }),
      shellFixture({ hasActionableProposedPlan: true, interactionMode: "plan" }),
    ];
    for (const shell of shells) Schema.asserts(OrchestrationV2ThreadShell, shell);
  });
});

describe("upstream's settle, as the needs list reads it", () => {
  const settled = (commandId: string | null): OrchestrationV2StoredEvent => ({
    sequence: 7,
    commandId: commandId === null ? null : CommandId.make(commandId),
    event: {
      id: EventId.make("event-settled"),
      type: "thread.settled",
      threadId: threadId("otter"),
      occurredAt: at(MINUTE),
      payload: {
        ...shellFixture({ id: "otter" }),
        lastVisitedAt: null,
        settledOverride: "settled",
        settledAt: at(0),
      },
    },
  });

  it("tells the person's settle, from any client, from upstream's own", () => {
    Schema.asserts(OrchestrationV2StoredEvent, settled(null));
    expect(settledByHandAt(settled("5f0c9b8e-2d4a-4c1e-9a7b-3e6f1d2c8b90"))).toBe(NOW);
    expect(settledByHandAt(settled("server:auto-settle:otter:5f0c9b8e"))).toBeNull();
    expect(settledByHandAt(settled("server:settle-after-run:run-1"))).toBeNull();
    expect(settledByHandAt(settled(null))).toBeNull();
  });

  it("keeps a settle by hand through the batch's later changes to its thread", () => {
    const otter = threadId("otter");
    expect(
      byThread([
        { threadId: otter, lively: true },
        { threadId: otter, lively: false, settledByHandAt: NOW },
        { threadId: otter, lively: false },
      ]),
    ).toEqual([{ threadId: otter, lively: true, settledByHandAt: NOW }]);
  });
});
