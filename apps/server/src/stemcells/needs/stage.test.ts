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
import type { Stop } from "./closeOut.ts";
import { ASKI_INSTANCE_ID, needOf, signalOf } from "./derive.ts";
import { standingsOf } from "./stage.ts";

const done: Stop = { ask: null, waits: false, line: "the header fix, merged as #12" };

/** The cards the list would hold for these shells. */
function cardsOf(...shells: ReadonlyArray<ReturnType<typeof shellFixture>>) {
  return shells.flatMap((shell) => {
    const signal = signalOf(shell, NOW);
    return signal === null || signal.kind === "prose" ? [] : [needOf(signal, {}, 1)];
  });
}

const stageOf = (
  shell: ReturnType<typeof shellFixture>,
  stop: Stop | null = done,
  cards = cardsOf(shell),
) =>
  standingsOf([shell], cards, stop === null ? new Map() : new Map([[shell.id, stop]]), NOW)[0]
    ?.stage ?? null;

describe("a Cell's stage", () => {
  it("is needs-you whenever it has a card, even with a run under way", () => {
    const asking = shellFixture({
      status: "waiting",
      activeRunId: runId("run-2"),
      pendingRuntimeRequest: pendingRequest("user_input"),
    });
    expect(stageOf(asking)).toBe("needs-you");
  });

  it("is needs-you on the parent when its subagent asks", () => {
    const parent = shellFixture({ status: "running", activeRunId: runId("run-2") });
    const child = shellFixture({
      id: "thread-reviewer",
      lineage: {
        rootThreadId: parent.id,
        parentThreadId: parent.id,
        relationshipToParent: "subagent",
      },
      pendingRuntimeRequest: pendingRequest("command"),
    });
    const cells = standingsOf([parent, child], cardsOf(child), new Map(), NOW);
    expect(cells.map((cell) => [cell.threadId, cell.stage])).toEqual([
      ["thread-floof", "needs-you"],
    ]);
  });

  it("is working while a run is under way, or while it waits on its own work or a reset", () => {
    expect(stageOf(shellFixture({ status: "running", activeRunId: runId("run-2") }), null)).toBe(
      "working",
    );
    expect(stageOf(shellFixture({ status: "queued" }), null)).toBe("working");
    expect(stageOf(shellFixture({ blockedOnThreadWait: true }))).toBe("working");
    expect(stageOf(shellFixture(), { ask: null, waits: true, line: "CI on #40" })).toBe("working");
    const carryingOn = shellFixture({
      status: "failed",
      lastErrorClass: "usage_limit",
      lastVisitedAt: at(0),
      limitRecovery: {
        runId: runId("run-1"),
        resetAt: DateTime.formatIso(at(HOUR)),
        autoResume: true,
      },
    });
    expect(stageOf(carryingOn)).toBe("working");
  });

  it("is done when its turn ended and nothing holds it, with its own line", () => {
    const [cell] = standingsOf(
      [shellFixture()],
      [],
      new Map([[threadId("thread-floof"), done]]),
      NOW,
    );
    expect(cell).toMatchObject({ stage: "done", line: "the header fix, merged as #12" });
    const seenFailure = shellFixture({ status: "failed", lastVisitedAt: at(0) });
    expect(stageOf(seenFailure, null)).toBe("done");
  });

  it("has none when settled, snoozed, archived, never run, or Aski's own", () => {
    expect(stageOf(shellFixture({ settledAt: at(-MINUTE) }))).toBeNull();
    expect(stageOf(shellFixture({ snoozedUntil: at(HOUR), snoozedAt: at(-MINUTE) }))).toBeNull();
    expect(stageOf(shellFixture({ archivedAt: at(-MINUTE) }))).toBeNull();
    expect(stageOf(shellFixture({ latestRunId: null }))).toBeNull();
    expect(
      stageOf(
        shellFixture({ providerInstanceId: instanceId(ASKI_INSTANCE_ID), pinnedAt: at(-HOUR) }),
      ),
    ).toBeNull();
  });

  it("lists the newest first, so a Cell keeps its row as its stage changes", () => {
    const older = shellFixture({ id: "thread-older", createdAt: at(-2 * HOUR) });
    const newer = shellFixture({
      id: "thread-newer",
      createdAt: at(-30 * MINUTE),
      status: "running",
      activeRunId: runId("run-9"),
    });
    const cells = standingsOf([older, newer], [], new Map(), NOW);
    expect(cells.map((cell) => cell.threadId)).toEqual(["thread-newer", "thread-older"]);
  });
});
