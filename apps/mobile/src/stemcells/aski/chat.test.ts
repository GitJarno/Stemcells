import { describe, expect, it } from "vite-plus/test";

import { askiChatsOf } from "./chat";

const chat = (id: string, patch: Record<string, unknown> = {}) =>
  ({
    id,
    environmentId: "mac",
    providerInstanceId: "aski",
    lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: id },
    pinnedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    deletedAt: null,
    ...patch,
  }) as Parameters<typeof askiChatsOf>[0][number];

describe("Aski's own chat", () => {
  it("is the pinned top-level chat on Aski's instance, else the first made, one a machine", () => {
    const first = chat("first");
    const later = chat("later", { createdAt: "2026-10-02T00:00:00.000Z" });
    expect([...askiChatsOf([later, first])]).toEqual(["first"]);
    const pinned = chat("pinned", {
      createdAt: "2026-10-03T00:00:00.000Z",
      pinnedAt: "2026-10-04T00:00:00.000Z",
    });
    expect([...askiChatsOf([first, later, pinned])]).toEqual(["pinned"]);
    const otherMac = chat("other", { environmentId: "mini" });
    expect(askiChatsOf([first, otherMac])).toEqual(new Set(["first", "other"]));
  });

  it("leaves a Cell on Aski's instance, a Subcell and another provider's chat as Cells", () => {
    const child = chat("child", {
      createdAt: "2026-09-01T00:00:00.000Z",
      lineage: { parentThreadId: "first", relationshipToParent: "subagent", rootThreadId: "first" },
    } as never);
    const codex = chat("codex", {
      providerInstanceId: "codex",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    expect([...askiChatsOf([chat("first"), child, codex])]).toEqual(["first"]);
  });
});
