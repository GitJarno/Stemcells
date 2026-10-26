import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { describe, expect, it } from "vite-plus/test";

import { shelvesOf } from "./column";

/** A shell with only what the shelves read; the rest of upstream's shape doesn't matter here. */
function shell(
  id: string,
  facts: Partial<{
    environmentId: string;
    settled: string;
    pinnedAt: string;
    pinOrderKey: string;
    parent: string;
    archived: boolean;
    instance: string;
  }> = {},
): EnvironmentThreadShell {
  return {
    environmentId: facts.environmentId ?? "env",
    id,
    title: `Chat ${id}`,
    providerInstanceId: facts.instance ?? "claude",
    lineage: { parentThreadId: facts.parent ?? null },
    archivedAt: facts.archived ? "2026-10-20T10:00:00.000Z" : null,
    deletedAt: null,
    settledOverride: facts.settled ? "settled" : null,
    settledAt: facts.settled ?? null,
    updatedAt: "2026-10-01T10:00:00.000Z",
    pinnedAt: facts.pinnedAt ?? null,
    pinOrderKey: facts.pinOrderKey ?? null,
  } as unknown as EnvironmentThreadShell;
}

const ids = (cells: ReadonlyArray<{ threadId: string }>) => cells.map((cell) => cell.threadId);

describe("the column's settled and pinned Cells", () => {
  it("lists the latest settled first", () => {
    const { settled } = shelvesOf(
      [
        shell("a", { settled: "2026-10-20T10:00:00.000Z" }),
        shell("b", { settled: "2026-10-25T10:00:00.000Z" }),
        shell("c"),
      ],
      "env",
    );
    expect(ids(settled)).toEqual(["b", "a"]);
  });

  it("keeps pins in the order the person set, then the oldest pin first", () => {
    const { pinned } = shelvesOf(
      [
        shell("late", { pinnedAt: "2026-10-25T10:00:00.000Z" }),
        shell("second", { pinnedAt: "2026-10-01T10:00:00.000Z", pinOrderKey: "b" }),
        shell("first", { pinnedAt: "2026-10-24T10:00:00.000Z", pinOrderKey: "a" }),
        shell("early", { pinnedAt: "2026-10-02T10:00:00.000Z" }),
      ],
      "env",
    );
    expect(ids(pinned)).toEqual(["first", "second", "early", "late"]);
  });

  it("leaves out Aski's chats, subagents, archived chats and other servers'", () => {
    const settled = "2026-10-20T10:00:00.000Z";
    const { settled: shown } = shelvesOf(
      [
        shell("aski", { settled, instance: "aski" }),
        shell("sub", { settled, parent: "a" }),
        shell("archived", { settled, archived: true }),
        shell("elsewhere", { settled, environmentId: "other" }),
        shell("cell", { settled }),
      ],
      "env",
    );
    expect(ids(shown)).toEqual(["cell"]);
  });
});
