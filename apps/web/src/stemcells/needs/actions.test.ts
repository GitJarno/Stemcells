import { describe, expect, it } from "vite-plus/test";

import { commandsFor } from "./actions";
import { NOW, needFixture, requestFixture } from "./fixtures";

const permission = needFixture({ request: requestFixture() });

describe("a choice as upstream's commands", () => {
  it("answers a permission with exactly the decision chosen", () => {
    expect(
      commandsFor(permission, { kind: "decide", decision: "acceptForSession" }, {}, NOW),
    ).toEqual([{ type: "respond", requestId: "request-1", decision: "acceptForSession" }]);
  });

  it("declines with a note as a decline, then the person's own words", () => {
    expect(
      commandsFor(permission, { kind: "declineWithNote" }, { words: " use staging " }, NOW),
    ).toEqual([
      { type: "respond", requestId: "request-1", decision: "decline" },
      { type: "message", text: "use staging" },
    ]);
    // No words, nothing sent: a bare decline is its own option.
    expect(commandsFor(permission, { kind: "declineWithNote" }, { words: " " }, NOW)).toEqual([]);
  });

  it("builds a plan through upstream's own implement path, with the plan the Cell wrote", () => {
    const plan = needFixture({
      kind: "plan",
      request: null,
      plan: { id: "plan-1", runId: "run-1", title: null, steps: [], markdown: "# Plan\n1. Do it" },
    });
    expect(commandsFor(plan, { kind: "build" }, {}, NOW)).toEqual([
      { type: "build", planId: "plan-1", markdown: "# Plan\n1. Do it" },
    ]);
  });

  it("carries on at a limit's reset by T3's own recovery, and resumes the stopped run when it has passed", () => {
    const limit = needFixture({
      kind: "limit",
      request: null,
      limit: { runId: "run-4", resetAt: "2026-10-21T18:00:00.000Z", autoResume: false },
    });
    expect(commandsFor(limit, { kind: "carryOn" }, {}, NOW)).toEqual([
      { type: "carryOnAtReset", runId: "run-4", resetAt: "2026-10-21T18:00:00.000Z" },
    ]);
    expect(commandsFor(limit, { kind: "continueNow" }, {}, NOW)).toEqual([
      { type: "message", text: "Continue where you left off.", continuationOfRunId: "run-4" },
    ]);
  });

  it("snoozes for an hour from now, and marks a failure seen as of now", () => {
    const failed = needFixture({
      kind: "failed",
      request: null,
      failure: { runId: "run-2", errorClass: "transport_error", message: null },
    });
    expect(commandsFor(failed, { kind: "later" }, {}, NOW)).toEqual([
      { type: "snooze", until: "2026-10-21T13:00:00.000Z" },
    ]);
    expect(commandsFor(failed, { kind: "dismiss" }, {}, NOW)).toEqual([
      { type: "visit", visitedAt: "2026-10-21T12:00:00.000Z" },
    ]);
  });
});
