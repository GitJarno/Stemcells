import { EnvironmentId, ProviderInstanceId, RunId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildThreadListV2Items,
  buildThreadListV2ListItems,
} from "../../../features/threads/threadListV2";
import { makeThreadShellFixture } from "../../../test-fixtures";
import { inAsleepOrder, inAwakeOrder } from "../listOrder";

/**
 * Contract: on the home's stages T3's list stands in each stage's own order (`useThreadListV2.ts`,
 * `../listOrder.ts`) over the items T3 builds with the shelves our substitutes set (the working
 * shelf on and open). A failure after a sync: T3's items no longer carry every Cell, or its pins,
 * the way the order reads them.
 */

const environmentId = EnvironmentId.make("environment-local");
const NOW = "2026-06-02T00:00:00.000Z";
const LAUNCHED = "2026-06-01T23:00:00.000Z";

const flying = {
  runtime: {
    status: "running" as const,
    activeRunId: RunId.make("run"),
    providerInstanceId: ProviderInstanceId.make("codex"),
    providerName: "Codex",
    lastError: null,
    updatedAt: NOW,
  },
  latestRun: {
    runId: RunId.make("run"),
    status: "running" as const,
    requestedAt: LAUNCHED,
    startedAt: LAUNCHED,
    completedAt: null,
    assistantMessageId: null,
  },
};
const landed = {
  runtime: null,
  latestRun: { ...flying.latestRun, status: "completed" as const, completedAt: NOW },
};

const cell = (id: string, createdAt: string, patch: object = {}) =>
  makeThreadShellFixture({
    environmentId,
    id: ThreadId.make(id),
    title: id,
    createdAt,
    latestUserAuthoredMessageAt: null,
    ...patch,
  });

const listed = (threads: ReturnType<typeof cell>[]) =>
  buildThreadListV2ListItems({
    items: buildThreadListV2Items({
      threads,
      environmentId: null,
      searchQuery: "",
      now: NOW,
      workingShelfEnabled: true,
      workingShelfExpanded: true,
      snoozedShelfExpanded: true,
      settledShelfExpanded: true,
    }).items,
    pendingTasks: [],
  });

const ids = (items: ReturnType<typeof inAwakeOrder>) =>
  items.flatMap((item) => (item.type === "v2-thread" ? [item.item.thread.id] : []));

describe("Awake's order", () => {
  const awake = (middle: object) => [
    cell("newest", "2026-06-01T03:00:00.000Z"),
    cell("middle", "2026-06-01T02:00:00.000Z", middle),
    cell("oldest", "2026-06-01T01:00:00.000Z"),
    cell("pinned", "2026-05-01T00:00:00.000Z", { pinnedAt: NOW }),
  ];

  /** Each row's shown time, as the line reads it from the Cells' machines. */
  const showing = (since: Record<string, string>) =>
    new Map(
      Object.entries(since).map(([id, at]) => [
        `${environmentId}:${id}`,
        { stage: "done" as const, since: at },
      ]),
    );

  it("stands each row by the time it shows, under the pins: a woken Cell among its own", () => {
    const woken = { ...landed, unsettledAt: NOW };
    const states = showing({
      newest: "2026-06-01T23:30:00.000Z",
      middle: "2026-06-01T00:30:00.000Z",
      oldest: "2026-06-01T12:00:00.000Z",
    });
    expect(ids(inAwakeOrder(listed(awake(woken)), states))).toEqual([
      "pinned",
      "newest",
      "oldest",
      "middle",
    ]);
  });
});

describe("Asleep's order", () => {
  it("lists the latest asleep first, a timed sleep saying when it wakes", () => {
    const items = inAsleepOrder(
      listed([
        cell("settled-early", "2026-05-01T00:00:00.000Z", {
          settledOverride: "settled",
          settledAt: "2026-06-01T10:00:00.000Z",
        }),
        cell("timed", "2026-05-01T00:00:00.000Z", {
          snoozedAt: "2026-06-01T20:00:00.000Z",
          snoozedUntil: "2026-06-02T03:00:00.000Z",
        }),
        cell("settled-late", "2026-05-01T00:00:00.000Z", {
          settledOverride: "settled",
          settledAt: "2026-06-01T22:00:00.000Z",
        }),
      ]),
      NOW,
    );
    expect(ids(items)).toEqual(["settled-late", "timed", "settled-early"]);
    const timed = items.find((item) => item.type === "v2-thread" && item.item.snoozed);
    expect(timed?.type === "v2-thread" && timed.snoozeWakeLabelText).toBe("Wakes in 3h");
  });
});
