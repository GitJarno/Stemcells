import { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { buildThreadListV2Items } from "../../../features/threads/threadListV2";
import { makeThreadShellFixture } from "../../../test-fixtures";

/**
 * Contract: Flying turns off T3's working shelf (`useThreadListV2.ts`), because the shelf sorts a
 * running Cell apart from the rest and a Cell between two turns hopped over the others and back.
 * A failure after a sync: the flag no longer means one order; hold Flying's rows some other way.
 */

const environmentId = EnvironmentId.make("environment-local");
const NOW = "2026-06-02T00:00:00.000Z";
const running = {
  status: "running" as const,
  activeRunId: null,
  providerInstanceId: ProviderInstanceId.make("codex"),
  providerName: "Codex",
  lastError: null,
  updatedAt: NOW,
};

const cell = (id: string, createdAt: string, between: boolean) =>
  makeThreadShellFixture({
    environmentId,
    id: ThreadId.make(id),
    title: id,
    createdAt,
    ...(between ? {} : { runtime: running }),
  });

const order = (workingShelfEnabled: boolean, between: boolean) =>
  buildThreadListV2Items({
    threads: [
      cell("newest", "2026-06-01T03:00:00.000Z", false),
      cell("middle", "2026-06-01T02:00:00.000Z", between),
      cell("oldest", "2026-06-01T01:00:00.000Z", false),
    ],
    environmentId: null,
    searchQuery: "",
    now: NOW,
    workingShelfEnabled,
  }).items.map((item) => item.thread.id);

describe("Flying's order", () => {
  it("moves nobody when a Cell comes to rest between two turns, with the shelf off", () => {
    expect(order(false, true)).toEqual(order(false, false));
  });

  it("would move them with the shelf on", () => {
    expect(order(true, true)).not.toEqual(order(true, false));
  });
});
