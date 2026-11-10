import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { HOUR, MINUTE, NOW, at, runId, shellFixture, threadId } from "../upstream/needs.fixture.ts";
import { conditionsOf } from "./conditions.ts";

const stopped = (id: string, over: Parameters<typeof shellFixture>[0] = {}) =>
  shellFixture({
    id,
    title: id,
    status: "failed",
    lastErrorClass: "usage_limit",
    usageLimitResetAt: DateTime.formatIso(at(5 * HOUR)),
    latestRunCompletedAt: at(-MINUTE),
    ...over,
  });

const child = (id: string, parent: string) =>
  stopped(id, {
    lineage: {
      rootThreadId: threadId(parent),
      parentThreadId: threadId(parent),
      relationshipToParent: "subagent",
    },
  });

describe("a stop many Cells share", () => {
  it("is one condition for an account's limit, its Cells under it, the longest held first", () => {
    const conditions = conditionsOf(
      [
        stopped("late"),
        stopped("early", { latestRunCompletedAt: at(-10 * MINUTE) }),
        // A few seconds apart in the refusals is the same reset.
        stopped("seconds", { usageLimitResetAt: DateTime.formatIso(at(5 * HOUR + 4000)) }),
        shellFixture({ id: "flying", status: "running", activeRunId: runId("run-2") }),
      ],
      NOW,
      true,
    );
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toMatchObject({
      kind: "limit",
      providerInstanceId: "codex",
      since: DateTime.formatIso(at(-10 * MINUTE)),
      waits: "reset",
    });
    expect(conditions[0]?.cells.map((cell) => cell.threadId)).toEqual(["early", "late", "seconds"]);
  });

  it("leaves out a sub-task, and what the person settled, snoozed or archived", () => {
    const conditions = conditionsOf(
      [
        stopped("parent"),
        child("sub-task", "parent"),
        stopped("settled", { settledOverride: "settled", settledAt: at(-MINUTE) }),
        stopped("snoozed", { snoozedUntil: at(HOUR), snoozedAt: at(-MINUTE) }),
        stopped("archived", { archivedAt: at(-MINUTE) }),
      ],
      NOW,
      true,
    );
    expect(conditions.flatMap((condition) => condition.cells.map((cell) => cell.threadId))).toEqual(
      ["parent"],
    );
  });

  it("waits on the reset only while a Cell carries on at it by itself", () => {
    const waits = (over: Parameters<typeof shellFixture>[0], autoResume = true) =>
      conditionsOf([stopped("cell", over)], NOW, autoResume)[0]?.waits;
    expect(waits({})).toBe("reset");
    // Auto-resume off, or cancelled for this run: nothing sends it on.
    expect(waits({}, false)).toBe("you");
    const optedOut = {
      runId: runId("run-1"),
      resetAt: DateTime.formatIso(at(5 * HOUR)),
      autoResume: false,
    };
    expect(waits({ limitRecovery: optedOut })).toBe("you");
    // No reset stated, or one long past with the Cell still stopped.
    expect(waits({ usageLimitResetAt: null })).toBe("you");
    expect(waits({ usageLimitResetAt: DateTime.formatIso(at(-20 * MINUTE)) })).toBe("you");
  });

  it("keeps two resets on one account, and two accounts, apart", () => {
    const keys = conditionsOf(
      [
        stopped("five-hour"),
        stopped("weekly", { usageLimitResetAt: DateTime.formatIso(at(48 * HOUR)) }),
        stopped("unknown", { usageLimitResetAt: null }),
      ],
      NOW,
      true,
    ).map((condition) => condition.key);
    expect(new Set(keys).size).toBe(3);
  });
});
