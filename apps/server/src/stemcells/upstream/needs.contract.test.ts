/**
 * Upstream shapes Aski's needs list reads (stemcells/tasks/aski-room.md,
 * "What T3 gives us to build on"). A failure here after a sync names what
 * moved: a request kind with no card, a run status the list doesn't place,
 * or a shell field the fixtures no longer match.
 */
import {
  OrchestrationV2ProviderFailureClass,
  OrchestrationV2RunStatus,
  OrchestrationV2RuntimeRequest,
  OrchestrationV2ThreadShell,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { REQUEST_KINDS } from "../needs/derive.ts";
import { HOUR, at, pendingRequest, runId, shellFixture } from "./needs.fixture.ts";

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
