import { describe, expect, it } from "vite-plus/test";

import { cellsToDress, waitsOnPerson } from "./crew";

type Shell = Parameters<typeof cellsToDress>[0][number] &
  Parameters<typeof waitsOnPerson>[0][number];

const chat = (id: string, patch: Record<string, unknown> = {}) =>
  ({
    id,
    environmentId: "mac",
    providerInstanceId: "claude",
    lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: id },
    pinnedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    archivedAt: null,
    deletedAt: null,
    settledOverride: null,
    snoozedUntil: null,
    snoozedAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    pendingSubagentRequest: null,
    interactionMode: "default",
    hasActionableProposedPlan: false,
    latestRun: null,
    runtime: null,
    blockedOnThreadWait: false,
    ...patch,
  }) as Shell;

const NOW = "2026-10-25T12:00:00.000Z";

describe("the Cells the collection speaks of", () => {
  it("offers one machine's Cells to dress, the most recently active first, twelve at most", () => {
    const at = (day: number) => `2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`;
    const many = Array.from({ length: 14 }, (_, n) => chat(`cell-${n}`, { updatedAt: at(n + 1) }));
    const aside = [
      chat("aski", { providerInstanceId: "aski", updatedAt: at(30) }),
      chat("archived", { archivedAt: at(20), updatedAt: at(29) }),
      chat("elsewhere", { environmentId: "mini", updatedAt: at(28) }),
      chat("subcell", {
        updatedAt: at(27),
        lineage: { parentThreadId: "cell-0", relationshipToParent: "subagent", rootThreadId: "x" },
      }),
    ];
    const ids = cellsToDress([...aside, ...many], "mac").map((thread) => thread.id);
    expect(ids).toEqual(Array.from({ length: 12 }, (_, n) => `cell-${13 - n}`));
    expect(cellsToDress([...aside, ...many], "mini").map((thread) => thread.id)).toEqual([
      "elsewhere",
    ]);
  });

  it("waits on the person only while a Cell of that machine does, one put away aside", () => {
    const asks = chat("asks", { hasPendingUserInput: true });
    expect(waitsOnPerson([chat("calm"), asks], "mac", NOW)).toBe(true);
    expect(waitsOnPerson([chat("calm"), asks], "mini", NOW)).toBe(false);
    expect(waitsOnPerson([chat("calm")], "mac", NOW)).toBe(false);
    const settled = chat("settled", { hasPendingUserInput: true, settledOverride: "settled" });
    const archived = chat("gone", { hasPendingUserInput: true, archivedAt: NOW });
    expect(waitsOnPerson([settled, archived], "mac", NOW)).toBe(false);
  });
});
