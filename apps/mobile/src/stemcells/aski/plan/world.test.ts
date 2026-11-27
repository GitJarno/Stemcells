import { describe, expect, it } from "vite-plus/test";

import { cellNameOf } from "../../../../../../stemcells/words/cellNames.ts";
import { placeKey, placeOfKey, type WorldShell, worldOf } from "./world";

const shell = (over: Partial<WorldShell> & Pick<WorldShell, "id" | "projectId">): WorldShell => ({
  environmentId: "mac",
  updatedAt: "2026-11-20T10:00:00.000Z",
  archivedAt: null,
  deletedAt: null,
  lineage: { parentThreadId: null },
  ...over,
});

const world = worldOf({
  environmentId: "mac",
  projects: [
    { environmentId: "mac", id: "p-atlas", title: "Atlas" },
    { environmentId: "mac", id: "p-harbor", title: "Harbor" },
    { environmentId: "mac", id: "p-old", title: "Old Site", archivedAt: "2026-10-01T00:00:00Z" },
    { environmentId: "mac", id: "p-scratch", title: "No project", isScratch: true },
    { environmentId: "mini", id: "p-otter", title: "Otter Docs" },
  ],
  shells: [
    shell({ id: "t-aski", projectId: "p-scratch", updatedAt: "2026-11-27T12:00:00.000Z" }),
    shell({ id: "t-1", projectId: "p-atlas", updatedAt: "2026-11-25T09:00:00.000Z" }),
    shell({ id: "t-2", projectId: "p-harbor", updatedAt: "2026-11-27T09:00:00.000Z" }),
    shell({ id: "t-3", projectId: "p-harbor", archivedAt: "2026-11-26T00:00:00.000Z" }),
    shell({ id: "t-4", projectId: "p-atlas", lineage: { parentThreadId: "t-1" } }),
    shell({ id: "t-5", projectId: "p-atlas" }),
    shell({ id: "t-6", projectId: "p-otter", environmentId: "mini" }),
  ],
  providers: [
    {
      instanceId: "claudeAgent",
      usable: true,
      word: "claude",
      models: [{ slug: "claude-fable-5-1", name: "Claude Fable 5.1", capabilities: null }],
    },
  ],
  effortOptions: ["effort"],
  aski: new Set(["t-aski"]),
  away: (one) => one.id === "t-5",
});

describe("the world the phone tells the compiler", () => {
  it("lists the machine's projects, the most recently used first", () => {
    expect(world.places).toEqual([
      { id: "mac:p-harbor", name: "Harbor" },
      { id: "mac:p-atlas", name: "Atlas" },
    ]);
  });

  it("names the awake Cells: no Subcell, none asleep or archived, never Aski's chat", () => {
    expect(world.cells).toEqual([
      { threadId: "t-1", name: cellNameOf("t-1") },
      { threadId: "t-2", name: cellNameOf("t-2") },
    ]);
  });

  it("turns a place's key back into its machine and project", () => {
    expect(placeOfKey(placeKey("mac", "p-harbor"))).toEqual({
      environmentId: "mac",
      projectId: "p-harbor",
    });
    expect(placeOfKey("p-harbor")).toBeNull();
  });
});
